// server/tooling/wsQuote_test.js
// Standalone resilient WS quote client

require('dotenv').config();

// ✅ PRODUCTION SAFETY: Disable tooling in production environment  
if (process.env.NODE_ENV === 'production') {
  console.log('🚫 Tooling disabled in production environment');
  process.exit(0);
}

const axios = require('axios');
const WebSocket = require('ws');
const https = require('https');
const { TokenManager } = require('../token-manager');
const { Broker, AccountSet } = require('../models');

const API_BASE_MT5 = process.env.MT5_API_URL || 'https://mt5.kdthecoder.com';
const WS_QUOTE_URL = 'wss://mt5.kdthecoder.com/wsQuote';
const SYMBOL_ENV   = process.env.TEST_QUOTE_SYMBOL || '';
const INTERVAL_MS  = Number(process.env.QUOTE_INTERVAL_MS);

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

function pickOneSymbolFromAccountSet(as) {
  if (!as) return null;
  return as.futureSymbol || as.spotSymbol || null;
}

(async () => {
  const broker = await Broker.findOne({ where: { terminal: 'MT5' } });
  if (!broker) {
    console.error('No MT5 broker found in DB.');
    process.exit(1);
  }

  const acctSet = await AccountSet.findByPk(broker.accountSetId);
  let symbol = SYMBOL_ENV || pickOneSymbolFromAccountSet(acctSet);
  if (!symbol) {
    console.error('No symbol found. Set TEST_QUOTE_SYMBOL in .env.');
    process.exit(1);
  }

  console.log(`Using broker ${broker.brokerName} ${broker.accountNumber} | symbol=${symbol}`);

  let token = null;
  let ws = null;
  let lastMsgAt = Date.now();
  let reconnects = 0;
  let hbTimer = null, idleTimer = null;

  const HEARTBEAT_SEC = Number(process.env.WS_HEARTBEAT_SEC || 20);
  const IDLE_TIMEOUT_SEC = Number(process.env.WS_IDLE_TIMEOUT_SEC || 60);

  function backoffDelay() {
    const base = 500;
    const cap = 15000;
    const exp = Math.min(cap, base * Math.pow(2, reconnects));
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(exp + jitter, cap);
  }

  function stopTimers() {
    if (hbTimer) clearInterval(hbTimer);
    if (idleTimer) clearInterval(idleTimer);
    hbTimer = null; idleTimer = null;
  }

  function startTimers() {
    stopTimers();
    hbTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) { try { ws.ping(); } catch {} }
    }, HEARTBEAT_SEC * 1000);

    idleTimer = setInterval(() => {
      const silent = (Date.now() - lastMsgAt) / 1000;
      if (silent > IDLE_TIMEOUT_SEC) {
        console.warn(`[idle] no messages for ${silent.toFixed(1)}s → reconnect`);
        try { ws.terminate(); } catch {}
      }
    }, 5000);
  }

  async function subscribe() {
    const subUrl = `${API_BASE_MT5}/Subscribe?id=${encodeURIComponent(token)}&symbol=${encodeURIComponent(symbol)}&interval=${INTERVAL_MS}`;
    try {
      const res = await axios.get(subUrl, { httpsAgent, timeout: 10000 });
      console.log('Subscribe status:', res.status);
    } catch (err) {
      console.warn('Subscribe failed:', err.message);
    }
  }

  async function connect() {
    try {
      token = await TokenManager.getToken(
        true,
        broker.server,
        broker.accountNumber,
        broker.password,
        broker.id,
        broker.position || 1
      );
      if (!token) throw new Error('No token from TokenManager');

      await subscribe();

      const wsUrl = `${WS_QUOTE_URL}?id=${encodeURIComponent(token)}`;
      console.log('Connecting WS:', wsUrl);
      ws = new WebSocket(wsUrl, { handshakeTimeout: 15000 });

      ws.on('open', () => {
        console.log('WS OPEN ✔');
        reconnects = 0;
        lastMsgAt = Date.now();
        startTimers();
      });

      ws.on('message', (buf) => {
        lastMsgAt = Date.now();
        try {
          const msg = JSON.parse(buf.toString());
          if (msg.Data) {
            // Parse nested JSON string inside Data
            let data = msg.Data;
            if (typeof data === 'string') {
              try { data = JSON.parse(data); } catch {}
            }
            console.log(`[${data.Symbol}] Bid=${data.Bid} Ask=${data.Ask} Spread=${data.Spread}`);
          } else {
            console.log(buf.toString().slice(0, 200));
          }
        } catch {
          console.log(buf.toString().slice(0, 200));
        }
      });

      ws.on('pong', () => { lastMsgAt = Date.now(); });

      ws.on('close', (code, reason) => {
        stopTimers();
        console.warn('WS CLOSE', code, reason?.toString() || '');
        scheduleReconnect();
      });

      ws.on('error', (err) => {
        stopTimers();
        console.warn('WS ERROR', err.message);
        scheduleReconnect();
      });
    } catch (err) {
      console.error('Connect failed:', err.message);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    reconnects++;
    const delay = backoffDelay();
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnects})`);
    setTimeout(connect, delay);
  }

  // Start first connect
  connect();

  process.on('SIGINT', () => {
    console.log('Stopping...');
    stopTimers();
    try { ws.close(); } catch {}
    process.exit(0);
  });
})();
