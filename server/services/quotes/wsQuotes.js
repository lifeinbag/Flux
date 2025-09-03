// server/services/quotes/wsQuotes.js
// WS-backed quote streamer that writes bid/ask + premium tables.
// Reads locked AccountSets, opens one WS per token, auto-resubscribes,
// and computes premiums using your existing DB formula.
//
// Does not touch existing REST endpoints.

require('dotenv').config();

const https = require('https');
const axios = require('axios');
const WebSocket = require('ws');

const sequelize = require('../../config/database');
const { Op } = require('sequelize');
const { AccountSet, Broker } = require('../../models');
const intelligentNormalizer = require('../../utils/intelligentBrokerNormalizer');
const { TokenManager } = require('../../token-manager');
const logger = require('../../utils/logger');

// ---------- Config ----------
const HEARTBEAT_SEC = Number(process.env.WS_HEARTBEAT_SEC);
const IDLE_TIMEOUT_SEC = Number(process.env.WS_IDLE_TIMEOUT_SEC);
const INTERVAL_MS = Number(process.env.QUOTE_INTERVAL_MS); // provider min interval

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

const API_BASE = {
  MT4: process.env.MT4_API_URL || 'https://mt4.kdthecoder.com',
  MT5: process.env.MT5_API_URL || 'https://mt5.kdthecoder.com',
};

function wsUrlFromApi(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return `wss://${u.host}/wsQuote`;
  } catch {
    return baseUrl.replace(/^http/i, 'ws').replace(/\/+$/, '') + '/wsQuote';
  }
}

const WS_QUOTE_URL = {
  MT4: wsUrlFromApi(API_BASE.MT4),
  MT5: wsUrlFromApi(API_BASE.MT5),
};

// ---------- State ----------
/** token -> client */
const clients = new Map();
/** accountSetId -> { future: Quote, spot: Quote, lastPremiumAt } */
const cache = new Map();
/** throttles for bid/ask: key = `${company}|${symbol}` -> lastWriteTs */
const lastBidAskAt = new Map();
/** token -> symbol -> [{ accountSetId, role, companyName, premiumTableName }] */
const indexByTokenSymbol = new Map();
/** misc throttles */
const lastUnmatchedLog = new Map();
/** once-per (token|symbol) unsubscribe guard */
const autoUnsubDone = new Set();

let started = false;

// ---------- Utilities ----------
function nowMs() { return Date.now(); }
function backoffDelay(attempt) {
  const base = 500, cap = 15000;
  const exp = Math.min(cap, base * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(exp + jitter, cap);
}
function keyBidAsk(company, symbol) { return `${company}|${symbol}`; }

// ----- JSON-like repair + regex helpers -----
function repairJsonLike(s) {
  if (typeof s !== 'string') return s;
  // Remove trailing commas before } or ]
  return s.replace(/,\s*([}\]])/g, '$1');
}

function extractFieldsFromText(s) {
  if (typeof s !== 'string') return null;
  const sym = /"Symbol"\s*:\s*"([^"]+)"/i.exec(s)?.[1];
  const bid = /"Bid"\s*:\s*"([^"]+)"/i.exec(s)?.[1];
  const ask = /"Ask"\s*:\s*"([^"]+)"/i.exec(s)?.[1];
  const spr = /"Spread"\s*:\s*"([^"]+)"/i.exec(s)?.[1];
  if (!sym || (!bid && !ask)) return null;
  return {
    symbol: sym,
    bid: bid !== undefined ? parseFloat(bid) : NaN,
    ask: ask !== undefined ? parseFloat(ask) : NaN,
    spread: spr !== undefined ? parseFloat(spr) : NaN,
  };
}

// --- tolerant WS message parser ---
function parseMarketWatchMessage(buf) {
  // Accept multiple shapes:
  // A) { Type:'MarketWatch'|'Quote', Id, Data:'{...}' }  // Data string may have trailing commas
  // B) { Type:'MarketWatch'|'Quote', Id, Data:{...} }    // Data is object
  // C) { Id, Symbol, Bid, Ask, Spread }                  // flat
  // D) { Symbol, Bid, Ask, Spread }                      // flat, no Id
  // E) Array of one or more of the above
  const text = buf.toString();

  // Try strict JSON parse
  let payload = null;
  try { payload = JSON.parse(text); } catch {
    const fx = extractFieldsFromText(text);
    if (fx) return { token: null, ...fx, raw: text };
    return null;
  }

  const normalizeOne = (msg) => {
    if (!msg || typeof msg !== 'object') return null;

    const id = msg.Id || msg.id || null;

    // Case A/B: Data wrapper
    if (msg.Data !== undefined) {
      let data = msg.Data;

      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          const fixed = repairJsonLike(data);
          try {
            data = JSON.parse(fixed);
          } catch {
            const fx = extractFieldsFromText(data);
            if (fx) return { token: id, ...fx, raw: data };
            return null;
          }
        }
      }

      if (data && typeof data === 'object' && data.Symbol !== undefined) {
        return {
          token: id,
          symbol: data.Symbol,
          bid: (data.Bid !== undefined) ? parseFloat(data.Bid) : (data.bid !== undefined ? parseFloat(data.bid) : NaN),
          ask: (data.Ask !== undefined) ? parseFloat(data.Ask) : (data.ask !== undefined ? parseFloat(data.ask) : NaN),
          spread: (data.Spread !== undefined) ? parseFloat(data.Spread) : (data.spread !== undefined ? parseFloat(data.spread) : NaN),
          raw: data,
        };
      }
    }

    // Case C/D: flat
    if (msg.Symbol !== undefined) {
      return {
        token: id,
        symbol: msg.Symbol,
        bid: (msg.Bid !== undefined) ? parseFloat(msg.Bid) : (msg.bid !== undefined ? parseFloat(msg.bid) : NaN),
        ask: (msg.Ask !== undefined) ? parseFloat(msg.Ask) : (msg.ask !== undefined ? parseFloat(msg.ask) : NaN),
        spread: (msg.Spread !== undefined) ? parseFloat(msg.Spread) : (msg.spread !== undefined ? parseFloat(msg.spread) : NaN),
        raw: msg,
      };
    }

    return null;
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const t = normalizeOne(item);
      if (t) return t;
    }
    return null;
  }

  return normalizeOne(payload);
}

// ---------- DB writers ----------
async function insertBidAsk(companyName, symbol, bid, ask) {
  const tableName = `bid_ask_${companyName}`;
  try {
    await sequelize.query(
      `INSERT INTO "${tableName}" (symbol, bid, ask, timestamp) VALUES (:symbol, :bid, :ask, NOW())`,
      { replacements: { symbol, bid, ask } }
    );
  } catch (err) {
    logger.error(`❌ bid_ask insert failed for ${tableName}/${symbol}: ${err.message}`);
  }
}

async function insertPremium(premiumTableName, accountSetId, futureQuote, spotQuote) {
  const buyPremium = futureQuote.ask - spotQuote.bid;
  const sellPremium = futureQuote.bid - spotQuote.ask;

  try {
    await sequelize.query(
      `INSERT INTO "${premiumTableName}" 
       (account_set_id, buy_premium, sell_premium, future_bid, future_ask, spot_bid, spot_ask, timestamp)
       VALUES (:accountSetId, :buyPremium, :sellPremium, :futureBid, :futureAsk, :spotBid, :spotAsk, NOW())`,
      {
        replacements: {
          accountSetId,
          buyPremium,
          sellPremium,
          futureBid: futureQuote.bid,
          futureAsk: futureQuote.ask,
          spotBid: spotQuote.bid,
          spotAsk: spotQuote.ask,
        }
      }
    );
  } catch (err) {
    logger.error(`❌ premium insert failed for ${premiumTableName} (AS=${accountSetId}): ${err.message}`);
  }
}

// ---------- Client management per token ----------
async function ensureClient(tokenKey, terminal, symbolsToSubscribe) {
  if (clients.has(tokenKey)) {
    const c = clients.get(tokenKey);
    for (const s of symbolsToSubscribe) c.symbols.add(s);
    return c;
  }

  const isMT5 = terminal === 'MT5';
  const apiBase = isMT5 ? API_BASE.MT5 : API_BASE.MT4;
  const wsUrl  = isMT5 ? WS_QUOTE_URL.MT5 : WS_QUOTE_URL.MT4;

  const c = {
    token: tokenKey,
    terminal,
    apiBase,
    wsUrl,
    ws: null,
    symbols: new Set(symbolsToSubscribe),
    reconnects: 0,
    heartbeatTimer: null,
    idleTimer: null,
    lastMsgAt: 0,
  };
  clients.set(tokenKey, c);

  await connectClient(c);
  return c;
}

function stopTimers(c) {
  if (c.heartbeatTimer) clearInterval(c.heartbeatTimer);
  if (c.idleTimer) clearInterval(c.idleTimer);
  c.heartbeatTimer = null;
  c.idleTimer = null;
}

async function subscribeAll(c) {
  const symbols = Array.from(c.symbols);
  if (symbols.length === 0) return;

  const subscribe = async (sym) => {
    const url = `${c.apiBase}/Subscribe?id=${encodeURIComponent(c.token)}&symbol=${encodeURIComponent(sym)}&interval=${Number(process.env.QUOTE_INTERVAL_MS)}`;
    try {
      const res = await axios.get(url, { httpsAgent, timeout: 10000 });
      logger.info(`[SUB] ${c.terminal} ${sym} → ${res.status}`);
    } catch (err) {
      logger.warn(`[SUB] failed ${c.terminal} ${sym}: ${err.message}`);
    }
  };

  for (const s of symbols) {
    await subscribe(s);
  }
}

async function connectClient(c) {
  try {
    await subscribeAll(c);

    const url = `${c.wsUrl}?id=${encodeURIComponent(c.token)}`;
    logger.info(`[WS→OPEN] ${c.terminal} ${url}`);
    c.ws = new WebSocket(url, { handshakeTimeout: 15000 });

    c.ws.on('open', () => {
      logger.info(`[WS] OPEN ${c.terminal}`);
      c.reconnects = 0;
      c.lastMsgAt = nowMs();

      stopTimers(c);
      c.heartbeatTimer = setInterval(() => {
        if (c.ws && c.ws.readyState === WebSocket.OPEN) {
          try { c.ws.ping(); } catch {}
        }
      }, Number(process.env.WS_HEARTBEAT_SEC) * 1000);

      c.idleTimer = setInterval(() => {
        const silent = (nowMs() - c.lastMsgAt) / 1000;
        if (silent > Number(process.env.WS_IDLE_TIMEOUT_SEC)) {
          logger.warn(`[WS] idle ${silent.toFixed(1)}s → reconnect`);
          try { c.ws.terminate(); } catch {}
        }
      }, 5000);
    });

    // --- one-time RAW preview + tolerant parsing ---
    let printedFirstRaw = false;

    c.ws.on('message', async (buf) => {
      c.lastMsgAt = nowMs();

      if (!printedFirstRaw) {
        try {
          const preview = buf.toString().slice(0, 400);
          logger.info(`[RAW1] ${c.terminal} ${preview}`);
        } catch {}
        printedFirstRaw = true;
      }

      const tick = parseMarketWatchMessage(buf);
      if (!tick) {
        const umKey = `${c.token}|RAW?`;
        const last = lastUnmatchedLog.get(umKey) || 0;
        if (nowMs() - last > 5000) {
          logger.warn(`[PARSE?] ${c.terminal} unparsed message preview: ${buf.toString().slice(0,120)}`);
          lastUnmatchedLog.set(umKey, nowMs());
        }
        return;
      }

      // Unknown (token,symbol) → auto-unsubscribe once to reduce noise
      const entries = getIndex(c.token, tick.symbol);
      if (entries.length === 0) {
        const unsubKey = `${c.token}|${tick.symbol}`;
        if (!autoUnsubDone.has(unsubKey)) {
          autoUnsubDone.add(unsubKey);
          try {
            const url = `${c.apiBase}/Unsubscribe?id=${encodeURIComponent(c.token)}&symbol=${encodeURIComponent(tick.symbol)}`;
            await axios.get(url, { httpsAgent, timeout: 8000 });
            logger.info(`[UNSUB] ${c.terminal} ${tick.symbol} (no AS mapping)`);
          } catch (e) {
            logger.warn(`[UNSUB?] token=${(c.token||'').slice(0,8)} symbol=${tick.symbol} → ${e.message}`);
          }
        }
        return;
      }

      // Debug (throttled)
      const umKey = `${c.token}|${tick.symbol}`;
      const last = lastUnmatchedLog.get(umKey) || 0;
      if (nowMs() - last > 5000) {
        logger.info(`[TICK] ${c.terminal} ${tick.symbol} ${isFinite(tick.bid) ? tick.bid : ''}/${isFinite(tick.ask) ? tick.ask : ''}`);
        lastUnmatchedLog.set(umKey, nowMs());
      }

      await handleTick(c.token, c.terminal, tick);
    });

    c.ws.on('pong', () => { c.lastMsgAt = nowMs(); });

    c.ws.on('close', (code, reason) => {
      stopTimers(c);
      logger.warn(`[WS] CLOSE ${c.terminal} code=${code} reason=${reason?.toString() || ''}`);
      scheduleReconnect(c);
    });

    c.ws.on('error', (err) => {
      stopTimers(c);
      logger.warn(`[WS] ERROR ${c.terminal} ${err.message}`);
      scheduleReconnect(c);
    });

  } catch (err) {
    logger.warn(`[WS] connect failed ${c.terminal}: ${err.message}`);
    scheduleReconnect(c);
  }
}

function scheduleReconnect(c) {
  c.reconnects += 1;
  const delay = backoffDelay(c.reconnects);
  logger.info(`[WS] reconnect in ${delay}ms (attempt ${c.reconnects})`);
  setTimeout(() => connectClient(c), delay);
}

// ---------- Index: token+symbol → accountSets ----------
function addIndex(token, symbol, entry) {
  if (!indexByTokenSymbol.has(token)) indexByTokenSymbol.set(token, new Map());
  const bySymbol = indexByTokenSymbol.get(token);
  if (!bySymbol.has(symbol)) bySymbol.set(symbol, []);
  bySymbol.get(symbol).push(entry);
}
function getIndex(token, symbol) {
  return indexByTokenSymbol.get(token)?.get(symbol) || [];
}

// ---------- Tick handler: update cache + DB ----------
async function handleTick(token, terminal, tick) {
  const entries = getIndex(token, tick.symbol);
  for (const ent of entries) {
    const asId = ent.accountSetId;
    const role = ent.role; // 'future' | 'spot'
    const company = ent.companyName;
    const symbol = tick.symbol;

    const lastAt = lastBidAskAt.get(`${company}|${symbol}`) || 0;
    if (nowMs() - lastAt >= Number(process.env.QUOTE_UPDATE_INTERVAL)) {
      lastBidAskAt.set(`${company}|${symbol}`, nowMs());
      await insertBidAsk(company, symbol, tick.bid, tick.ask);
      logger.info(`[BA] ${company}/${symbol} ${tick.bid}/${tick.ask}`);
    }

    if (!cache.has(asId)) cache.set(asId, { future: null, spot: null, lastPremiumAt: 0 });
    const asCache = cache.get(asId);
    asCache[role] = { bid: tick.bid, ask: tick.ask, ts: nowMs(), symbol, terminal };

    if (asCache.future && asCache.spot) {
      if (nowMs() - asCache.lastPremiumAt >= Number(process.env.PREMIUM_COLLECTION_INTERVAL)) {
        asCache.lastPremiumAt = nowMs();
        const buy = asCache.future.ask - asCache.spot.bid;
        const sell = asCache.future.bid - asCache.spot.ask;
        await insertPremium(ent.premiumTableName, asId, asCache.future, asCache.spot);
        logger.info(`[PR] AS=${asId} ${asCache.future.symbol}↔${asCache.spot.symbol} → buy=${buy.toFixed(2)} sell=${sell.toFixed(2)}`);
      }
    }
  }
}

// ---------- Public API ----------
async function start() {
  if (started) return;
  started = true;

  const sets = await AccountSet.findAll({
    where: {
      symbolsLocked: true,
      futureSymbol: { [Op.ne]: null },
      spotSymbol: { [Op.ne]: null }
    },
    order: [['id','ASC']]
  });

  if (!sets || sets.length === 0) {
    logger.info('WSQuotes: No locked AccountSets with symbols found.');
    return;
  }

  logger.info(`WSQuotes: starting for ${sets.length} locked account sets`);

  for (const set of sets) {
    const brokers = await Broker.findAll({
      where: { accountSetId: set.id },
      order: [['position','ASC']]
    });

    const futureBroker = brokers.find(b => b.position === 1);
    const spotBroker   = brokers.find(b => b.position === 2);
    if (!futureBroker || !spotBroker) {
      logger.warn(`WSQuotes: Skip AS ${set.id}: missing broker at position 1 or 2`);
      continue;
    }

    const company1 = await intelligentNormalizer.normalizeBrokerName(
      futureBroker.brokerName, futureBroker.server, futureBroker.companyName
    );
    const company2 = await intelligentNormalizer.normalizeBrokerName(
      spotBroker.brokerName, spotBroker.server, spotBroker.companyName
    );

    const token1 = await TokenManager.getToken(
      (futureBroker.terminal || '').toUpperCase() === 'MT5',
      futureBroker.server, futureBroker.accountNumber, futureBroker.password,
      futureBroker.id, futureBroker.position || 1
    );
    const token2 = await TokenManager.getToken(
      (spotBroker.terminal || '').toUpperCase() === 'MT5',
      spotBroker.server, spotBroker.accountNumber, spotBroker.password,
      spotBroker.id, spotBroker.position || 2
    );

    const sym1 = set.futureSymbol;
    const sym2 = set.spotSymbol;

    addIndex(token1, sym1, { accountSetId: set.id, role: 'future', companyName: company1, premiumTableName: set.premiumTableName });
    addIndex(token2, sym2, { accountSetId: set.id, role: 'spot',   companyName: company2, premiumTableName: set.premiumTableName });

    await ensureClient(token1, (futureBroker.terminal || '').toUpperCase(), [sym1]);
    await ensureClient(token2, (spotBroker.terminal || '').toUpperCase(), [sym2]);

    logger.info(`WSQuotes AS ${set.name || set.id}: ${company1}/${sym1} ↔ ${company2}/${sym2} → table "${set.premiumTableName}"`);
  }

  // graceful shutdown hook
  process.on('SIGINT', stop);
}

async function stop() {
  if (!started) return;
  started = false;

  try {
    for (const c of clients.values()) {
      try { c.ws?.terminate(); } catch {}
      stopTimers(c);
    }
  } catch {}
  logger.info('WSQuotes: stopped.');
}

module.exports = { start, stop };