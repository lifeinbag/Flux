// server/routes/trading.js
require('dotenv').config();
const express = require('express');
const https = require('https');
const axios = require('axios');
const auth = require('../middleware/auth');
const { AccountSet, Broker } = require('../models/AccountSet');
const User = require('../models/User');
const { TokenManager, TokenError } = require('../token-manager');
const brokerSymbolsCache = require('../utils/brokerSymbolsCache');
const intelligentNormalizer = require('../utils/intelligentBrokerNormalizer');
const { sequelize, ActiveTrade, ClosedTrade, PendingOrder } = require('../models');
const latencyMonitor = require('../services/latencyMonitor');
const tradingService = require('../services/tradingService');

// Helper to unify incoming param name
function extractBrokerId(req) {
  return req.query.id ?? req.query.accountSetId;
}

// ─── Broker gateway clients ───────────────────────────────────
const axiosMT4 = axios.create({
  baseURL: process.env.MT4_API_URL,
  timeout: 10_000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

const axiosMT5 = axios.create({
  baseURL: process.env.MT5_API_URL,
  timeout: 10_000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

const router = express.Router();
router.use(auth);

async function getValidToken(broker, isMT5) {
  const now = Date.now();
  
  // Check database token first (with 5-minute buffer)
  const tokenValid = broker.token && 
                    broker.tokenExpiresAt && 
                    new Date(broker.tokenExpiresAt).getTime() > (now + 300000);
  
  if (tokenValid) {
    return broker.token;
  }
  
  try {
    // Clear expired token
    broker.token = null;
    broker.tokenExpiresAt = null;
    await broker.save();
    
    // Use simplified TokenManager
    const token = await TokenManager.getToken(
      isMT5,
      broker.server,
      broker.accountNumber,
      broker.password,
      broker.id
    );
    
    // Save to database
    broker.token = token;
    broker.tokenExpiresAt = new Date(Date.now() + 22 * 60 * 60 * 1000);
    await broker.save();
    
    return token;
    
  } catch (error) {
    throw error;
  }
}

async function findBroker(brokerId, userId, isAdmin) {
  try {
    // Handle undefined brokerId explicitly
    if (!brokerId || brokerId === 'undefined') {
      throw new Error('Broker ID is required');
    }

    const broker = await Broker.findByPk(brokerId);
    
    if (!broker) {
      throw new Error('Broker not found');
    }
    
    if (!isAdmin) {
      const accountSet = await AccountSet.findOne({
        where: { 
          id: broker.accountSetId,
          userId: userId 
        }
      });
      
      if (!accountSet) {
        throw new Error('Access denied');
      }
    }
    
    return broker;
  } catch (error) {
    throw new Error(`Broker not found or access denied: ${error.message}`);
  }
}

// ─── GET /api/trading/symbols?terminal=MT4|MT5&id=<brokerId> ─────────────────
router.get('/symbols', async (req, res) => {
  try {
    const { terminal } = req.query;
    const brokerId = extractBrokerId(req);
    const isMT5 = terminal === 'MT5';
    const isAdmin = req.user.role === 'admin';
    const broker = await findBroker(brokerId, req.user.id, isAdmin);

    if (!broker) {
      return res.status(404).json({ success: false, message: 'Broker not found' });
    }

    // ✅ FIX: Use the broker symbol cache for speed and reliability
    const token = await getValidToken(broker, isMT5);
    const symbols = await brokerSymbolsCache.getSymbolsForBroker(
      broker.brokerName, broker.server, terminal, token
    );

    if (!symbols) {
      return res.status(404).json({ success: false, message: 'Could not fetch symbols.' });
    }

    return res.json({ success: true, symbols });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/trading/quote?terminal=MT4|MT5&id=<brokerId>&symbol=XYZ ─────────
router.get('/quote', async (req, res) => {
  const startTime = Date.now();
  let brokerId;
  
  try {
    const { terminal } = req.query;
    brokerId = extractBrokerId(req);
    const { symbol } = req.query;
    const isMT5 = terminal === 'MT5';
    const isAdmin = req.user.role === 'admin';
    const broker = await findBroker(brokerId, req.user.id, isAdmin);
    
    if (!broker) {
      return res.status(404).json({ success: false, message: 'Broker not found' });
    }
    
    const token = await getValidToken(broker, isMT5);
    const client = isMT5 ? axiosMT5 : axiosMT4;
    
    const resp = await client.get('/GetQuote', { params: { id: token, symbol } });
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record quote ping latency
    latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    
    return res.json({ 
      success: true, 
      data: { ...resp.data, latency }
    });
  } catch (err) {
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record latency even for failed requests
    if (brokerId) {
      latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    }
    
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trading/quote/:symbol - Uses database cache with live API fallback
router.get('/quote/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { terminal } = req.query;
  const brokerId = extractBrokerId(req);
  const isAdmin = req.user.role === 'admin';

  if (!symbol) {
    return res.status(400).json({
      success: false,
      message: 'Symbol is required'
    });
  }

  if (!brokerId || brokerId === 'undefined') {
    return res.status(400).json({
      success: false,
      message: 'Valid brokerId is required'
    });
  }

  if (!terminal || !['MT4','MT5'].includes(terminal)) {
    return res.status(400).json({
      success: false,
      message: 'Valid terminal (MT4 or MT5) is required'
    });
  }

  try {
    const broker = await findBroker(brokerId, req.user.id, isAdmin);
    
    if (broker.terminal !== terminal) {
      return res.status(400).json({
        success: false,
        message: `Broker is configured for ${broker.terminal}, not ${terminal}`
      });
    }

    let data = null;

    // Try cache first
    try {
      const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(
        broker.brokerName, 
        broker.server, 
        broker.companyName
      );
      
      const tableName = `bid_ask_${normalizedBroker}`;
      
      const [results] = await sequelize.query(`
        SELECT symbol, bid, ask, timestamp 
        FROM "${tableName}" 
        WHERE symbol = :symbol 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, {
        replacements: { symbol }
      });

      if (results.length > 0) {
        const quote = results[0];
        data = {
          bid: parseFloat(quote.bid),
          ask: parseFloat(quote.ask),
          symbol: quote.symbol,
          timestamp: quote.timestamp,
          cached: true
        };
      }
    } catch (cacheError) {
      // Cache lookup failed, continue to live API
    }

    // Fallback to live API if no cache data
    if (!data) {
      try {
        const mtToken = await getValidToken(broker, broker.terminal === 'MT5');
        
        // Gateway-proxy: reuse the shared client
        const client = broker.terminal === 'MT5' ? axiosMT5 : axiosMT4;
        const response = await client.get('/GetQuote', {
          params: { id: mtToken, symbol }
        });

        if (response.data && response.data.bid && response.data.ask) {
          data = {
            bid: parseFloat(response.data.bid),
            ask: parseFloat(response.data.ask),
            symbol,
            timestamp: new Date(),
            cached: false
          };
        }
      } catch (liveError) {
        // Live fetch failed
      }
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found in cache and live fetch failed'
      });
    }
    
    return res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch quote' 
    });
  }
});

// POST /api/trading/connect
router.post('/connect', async (req, res) => {
  const { terminal, serverName, accountNumber, password } = req.body;
  if (!['MT4','MT5'].includes(terminal) || !serverName?.trim() || 
      !/^\d+$/.test(accountNumber) || !password) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payload'
    });
  }

  try {
    // Create a temporary broker object to leverage existing token validation logic
    const tempBroker = {
      terminal,
      server: serverName.trim(),
      accountNumber,
      password,
      token: null,
      tokenExpiresAt: null
    };
    
    // Check if we have a valid cached token first
    const now = Date.now();
    const tokenValid = tempBroker.token && 
                      tempBroker.tokenExpiresAt && 
                      new Date(tempBroker.tokenExpiresAt).getTime() > (now + 300000);
    
    let token;
    if (tokenValid) {
      token = tempBroker.token;
      console.log(`✅ Using cached token for ${terminal} ${accountNumber}`);
    } else {
      // Fetch new token using TokenManager
      console.log(`🔄 Fetching new token for ${terminal} ${accountNumber}...`);
      token = await TokenManager.getToken(terminal === 'MT5', serverName.trim(), accountNumber, password);
    }
    
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let tradingAccounts = user.tradingAccounts || [];
    const existingIndex = tradingAccounts.findIndex(acc => acc.terminal === terminal);
    
    const accountData = { terminal, serverName: serverName.trim(), accountNumber, token };
    
    if (existingIndex >= 0) {
      tradingAccounts[existingIndex] = accountData;
    } else {
      tradingAccounts.push(accountData);
    }

    user.tradingAccounts = tradingAccounts;
    await user.save();
    
    return res.json({ success: true, token });
  } catch (err) {
    return res.status(err.response?.status === 400 ? 400 : 500).json({
      success: false, message: err.message || 'Server error'
    });
  }
});

// GET /api/trading/balance - Uses direct API URLs
router.get('/balance', async (req, res) => {
  const { terminal } = req.query;
  const brokerId = extractBrokerId(req);
  const isMT5 = terminal === 'MT5';
  const isAdmin = req.user.role === 'admin';

  if (!['MT4','MT5'].includes(terminal) || !brokerId) {
    return res.status(400).json({
      success: false,
      message: 'terminal and id are required'
    });
  }

  try {
    const broker = await findBroker(brokerId, req.user.id, isAdmin);
    
    if (broker.terminal !== terminal) {
      return res.status(400).json({
        success: false,
        message: `Broker configured for ${broker.terminal}, not ${terminal}`
      });
    }
    
    const mtToken = await getValidToken(broker, isMT5);
    
    const client = isMT5 ? axiosMT5 : axiosMT4;
    
    const { data: balance } = await client.get('/AccountSummary', { 
      params: { id: mtToken } 
    });

    return res.json({ success: true, balance });
  } catch (err) {
    if (err instanceof TokenError) {
      return res.status(502).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trading/positions - Uses direct API URLs
router.get('/positions', async (req, res) => {
  const { terminal } = req.query;
  const brokerId = extractBrokerId(req);
  const isMT5 = terminal === 'MT5';
  const isAdmin = req.user.role === 'admin';

  if (!['MT4','MT5'].includes(terminal) || !brokerId) {
    return res.status(400).json({
      success: false,
      message: 'terminal and id are required'
    });
  }

  try {
    const broker = await findBroker(brokerId, req.user.id, isAdmin);
    
    if (broker.terminal !== terminal) {
      return res.status(400).json({
        success: false,
        message: `Broker configured for ${broker.terminal}, not ${terminal}`
      });
    }
    
    const mtToken = await getValidToken(broker, isMT5);
    
    const client = isMT5 ? axiosMT5 : axiosMT4;
    
    let positions = [];
    try {
      const resp = await client.get('/OpenedOrders', { 
        params: { id: mtToken } 
      });
      positions = resp.data;
    } catch (err) {
      if (err.response?.status === 404) positions = [];
      else throw err;
    }

    return res.json({ success: true, positions });
  } catch (err) {
    if (err instanceof TokenError) {
      return res.status(502).json({ success: false, message: err.message });
    }
    return res.status(err.response?.status || 500).json({ success: false, message: err.message || 'Server error' });
  }
});

// GET /api/trading/mt5-symbols  
router.get('/mt5-symbols', async (req, res) => {
  const brokerId = extractBrokerId(req);
  const isAdmin = req.user.role === 'admin';

  if (!brokerId) {
    return res.status(400).json({
      success: false,
      message: 'id (broker ID) is required'
    });
  }

  try {
    const broker = await findBroker(brokerId, req.user.id, isAdmin);
    
    if (broker.terminal !== 'MT5') {
      return res.status(400).json({
        success: false,
        message: `Broker configured for ${broker.terminal}, not MT5`
      });
    }
    
    const mtToken = await getValidToken(broker, true);
    
    const symbols = await brokerSymbolsCache.getSymbolsForBroker(
      broker.brokerName, broker.server, 'MT5', mtToken
    );

    return res.json({ success: true, symbols });
  } catch (err) {
    if (err instanceof TokenError) {
      return res.status(502).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trading/mt4-symbols
router.get('/mt4-symbols', async (req, res) => {
  const brokerId = extractBrokerId(req);
  const isAdmin = req.user.role === 'admin';

  if (!brokerId) {
    return res.status(400).json({
      success: false,
      message: 'id (broker ID) is required'
    });
  }

  try {
    const broker = await findBroker(brokerId, req.user.id, isAdmin);
    
    if (broker.terminal !== 'MT4') {
      return res.status(400).json({
        success: false,
        message: `Broker configured for ${broker.terminal}, not MT4`
      });
    }
    
    const mtToken = await getValidToken(broker, false);
    
    const symbols = await brokerSymbolsCache.getSymbolsForBroker(
      broker.brokerName, broker.server, 'MT4', mtToken
    );

    return res.json({ success: true, symbols });
  } catch (err) {
    if (err instanceof TokenError) {
      return res.status(502).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/refresh-symbols', async (req, res) => {
  const { brokerId, terminal } = req.body;
  const isAdmin = req.user.role === 'admin';

  if (!brokerId || !terminal) {
    return res.status(400).json({
      success: false,
      message: 'brokerId and terminal are required'
    });
  }

  try {
    const broker = await findBroker(brokerId, req.user.id, isAdmin);
    
    if (broker.terminal !== terminal) {
      return res.status(400).json({
        success: false,
        message: `Broker configured for ${broker.terminal}, not ${terminal}`
      });
    }
    
    const mtToken = await getValidToken(broker, terminal === 'MT5');
    
    const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(
      broker.brokerName, broker.server
    );
    
    const freshSymbols = await brokerSymbolsCache.refreshBrokerSymbols(
      normalizedBroker, terminal, mtToken, broker.server, broker.brokerName
    );

    return res.json({ success: true, symbols: freshSymbols });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// LEGACY endpoints (simplified)
router.get('/mt5-symbols-legacy', async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const tradingAccounts = user.tradingAccounts || [];
    const mt5Account = tradingAccounts.find(acc => acc.terminal === 'MT5');
    
    if (!mt5Account?.token) {
      return res.status(400).json({ error: 'MT5 account not linked' });
    }

    const response = await axiosMT5.get('/Symbols', {params: { id: mt5Account.token }});
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch MT5 symbols' });
  }
});

router.get('/mt4-symbols-legacy', async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const tradingAccounts = user.tradingAccounts || [];
    const mt4Account = tradingAccounts.find(acc => acc.terminal === 'MT4');
    
    if (!mt4Account?.token) {
      return res.status(400).json({ error: 'MT4 account not linked' });
    }

    const response = await axiosMT4.get('/Symbols', {params: { id: mt4Account.token }});
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch MT4 symbols' });
  }
});

router.get('/mt5-quote/:symbol', async (req, res) => {
  const startTime = Date.now();
  let brokerId;
  
  try {
    const { symbol } = req.params;
    const user = await User.findByPk(req.user.id);
    const tradingAccounts = user.tradingAccounts || [];
    const mt5Account = tradingAccounts.find(acc => acc.terminal === 'MT5');
    brokerId = mt5Account?.id;
    
    if (!mt5Account?.token) {
      return res.status(400).json({ error: 'MT5 account not linked' });
    }

    const response = await axiosMT5.get('/GetQuote', {params: { id: mt5Account.token, symbol }});
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record quote ping latency
    if (brokerId) {
      latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    }
    
    res.json({ ...response.data, latency });
  } catch (error) {
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record latency even for failed requests
    if (brokerId) {
      latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    }
    
    res.status(500).json({ error: 'Failed to fetch MT5 quote' });
  }
});

router.get('/mt4-quote/:symbol', async (req, res) => {
  const startTime = Date.now();
  let brokerId;
  
  try {
    const { symbol } = req.params;
    const user = await User.findByPk(req.user.id);
    const tradingAccounts = user.tradingAccounts || [];
    const mt4Account = tradingAccounts.find(acc => acc.terminal === 'MT4');
    brokerId = mt4Account?.id;
    
    if (!mt4Account?.token) {
      return res.status(400).json({ error: 'MT4 account not linked' });
    }

    const response = await axiosMT4.get('/GetQuote', {params: { id: mt4Account.token, symbol }});
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record quote ping latency
    if (brokerId) {
      latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    }
    
    res.json({ ...response.data, latency });
  } catch (error) {
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record latency even for failed requests
    if (brokerId) {
      latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    }
    
    res.status(500).json({ error: 'Failed to fetch MT4 quote' });
  }
});

// ─── POST /api/trading/execute-current - Execute trades at current premium ─────────
router.post('/execute-current', async (req, res) => {
  try {
    const {
      accountSetId,
      direction,
      volume,
      takeProfit,
      stopLoss,
      scalpingMode,
      comment
    } = req.body;

    // Validation
    if (!accountSetId || !direction || !volume) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: accountSetId, direction, volume'
      });
    }

    if (!['Buy', 'Sell'].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: 'Direction must be Buy or Sell'
      });
    }

    const volumeNum = parseFloat(volume);
    if (isNaN(volumeNum) || volumeNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Volume must be a positive number'
      });
    }

    // Execute trade
    const result = await tradingService.executeAtCurrentPremium({
      accountSetId,
      userId: req.user.id,
      direction,
      volume: volumeNum,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      scalpingMode: scalpingMode || false,
      comment: comment || 'FluxNetwork Trade'
    });

    if (result.success) {
      return res.json({
        success: true,
        trade: result.trade,
        executionDetails: result.executionDetails,
        message: 'Trade executed successfully at current premium'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── POST /api/trading/execute-target - Execute trades at target premium ─────────
router.post('/execute-target', async (req, res) => {
  try {
    const {
      accountSetId,
      direction,
      volume,
      targetPremium,
      takeProfit,
      stopLoss,
      scalpingMode,
      comment
    } = req.body;

    // Validation
    if (!accountSetId || !direction || !volume || targetPremium === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: accountSetId, direction, volume, targetPremium'
      });
    }

    if (!['Buy', 'Sell'].includes(direction)) {
      return res.status(400).json({
        success: false,
        message: 'Direction must be Buy or Sell'
      });
    }

    const volumeNum = parseFloat(volume);
    const targetPremiumNum = parseFloat(targetPremium);
    
    if (isNaN(volumeNum) || volumeNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Volume must be a positive number'
      });
    }

    if (isNaN(targetPremiumNum)) {
      return res.status(400).json({
        success: false,
        message: 'Target premium must be a valid number'
      });
    }

    // Create pending order
    const result = await tradingService.executeAtTargetPremium({
      accountSetId,
      userId: req.user.id,
      direction,
      volume: volumeNum,
      targetPremium: targetPremiumNum,
      takeProfit: takeProfit ? parseFloat(takeProfit) : null,
      stopLoss: stopLoss ? parseFloat(stopLoss) : null,
      scalpingMode: scalpingMode || false,
      comment: comment || 'FluxNetwork Target Order'
    });

    if (result.success) {
      return res.json({
        success: true,
        pendingOrder: result.pendingOrder,
        message: result.message
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── GET /api/trading/last-order-latency/:accountSetId - Get last order latency for account set ─────────
router.get('/last-order-latency/:accountSetId', async (req, res) => {
  try {
    const { accountSetId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Find account set
    let whereClause = { id: accountSetId };
    if (!isAdmin) {
      whereClause.userId = userId;
    }

    const accountSet = await AccountSet.findOne({
      where: whereClause,
      include: [
        {
          model: Broker,
          as: 'brokers',
          attributes: ['id', 'terminal', 'brokerName', 'position'],
          order: [['position', 'ASC']]
        }
      ]
    });

    if (!accountSet) {
      return res.status(404).json({
        success: false,
        message: 'Account set not found or access denied'
      });
    }

    const broker1 = accountSet.brokers.find(b => b.position === 1);
    const broker2 = accountSet.brokers.find(b => b.position === 2);

    res.json({
      success: true,
      data: {
        accountSetId,
        lastOrderTimestamp: accountSet.lastOrderTimestamp,
        broker1: {
          id: broker1?.id,
          name: broker1?.brokerName,
          terminal: broker1?.terminal,
          latency: accountSet.lastOrderBroker1Latency
        },
        broker2: {
          id: broker2?.id, 
          name: broker2?.brokerName,
          terminal: broker2?.terminal,
          latency: accountSet.lastOrderBroker2Latency
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── POST /api/trading/test-order-latency - Test OrderSend latency without executing ─────────
router.post('/test-order-latency', async (req, res) => {
  try {
    const { brokerId, terminal, symbol = 'EURUSD' } = req.body;
    
    if (!brokerId || !terminal) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: brokerId, terminal'
      });
    }
    
    const isAdmin = req.user.role === 'admin';
    const broker = await findBroker(brokerId, req.user.id, isAdmin);
    
    if (!broker) {
      return res.status(404).json({
        success: false,
        error: 'Broker not found'
      });
    }
    
    const token = await getValidToken(broker, terminal === 'MT5');
    
    // Test OrderSend latency using the latency monitor
    const result = await latencyMonitor.testOrderSendEndpoint(terminal, brokerId, {
      id: token,
      symbol,
      operation: 'Buy',
      volume: '0.01'
    });
    
    if (result.success || result.latency) {
      latencyMonitor.addLatencyRecord(brokerId, 'orderSend', result.latency);
    }
    
    // Also test quote ping if possible
    let quotePingResult = null;
    try {
      quotePingResult = await latencyMonitor.measureQuotePing(terminal, brokerId, symbol, token);
      if (quotePingResult.success || quotePingResult.latency) {
        latencyMonitor.addLatencyRecord(brokerId, 'quotePing', quotePingResult.latency);
      }
    } catch (quoteErr) {
      // Quote ping test failed, but that's okay
    }
    
    res.json({
      success: true,
      data: {
        orderSend: {
          latency: result.latency,
          success: result.success,
          error: result.error
        },
        quotePing: quotePingResult ? {
          latency: quotePingResult.latency,
          success: quotePingResult.success,
          bid: quotePingResult.bid,
          ask: quotePingResult.ask
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ─── GET /api/trading/active-trades - Get active trades for user ─────────
router.get('/active-trades', async (req, res) => {
  try {
    const { accountSetId } = req.query;
    const userId = req.user.id;
    
    let whereClause = { userId };
    if (accountSetId) {
      whereClause.accountSetId = accountSetId;
    }

    // Only get trades with 'Active' status
    whereClause.status = 'Active';

    const activeTrades = await ActiveTrade.findAll({
      where: whereClause,
      include: [
        { 
          model: AccountSet, 
          attributes: ['id', 'name', 'futureSymbol', 'spotSymbol']
        },
        {
          model: Broker,
          as: 'broker1',
          attributes: ['id', 'terminal', 'server', 'brokerName']
        },
        {
          model: Broker,
          as: 'broker2',
          attributes: ['id', 'terminal', 'server', 'brokerName']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      trades: activeTrades,
      count: activeTrades.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── GET /api/trading/pending-orders - Get pending orders for user ─────────
router.get('/pending-orders', async (req, res) => {
  try {
    const { accountSetId } = req.query;
    const userId = req.user.id;
    
    let whereClause = { userId, status: 'Pending' };
    if (accountSetId) {
      whereClause.accountSetId = accountSetId;
    }

    const pendingOrders = await PendingOrder.findAll({
      where: whereClause,
      include: [
        { 
          model: AccountSet, 
          attributes: ['id', 'name', 'futureSymbol', 'spotSymbol']
        },
        {
          model: Broker,
          as: 'broker1',
          attributes: ['id', 'terminal', 'server', 'brokerName']
        },
        {
          model: Broker,
          as: 'broker2',
          attributes: ['id', 'terminal', 'server', 'brokerName']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      orders: pendingOrders,
      count: pendingOrders.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── GET /api/trading/closed-trades - Get closed trades for user ─────────
router.get('/closed-trades', async (req, res) => {
  try {
    const { accountSetId, limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;
    
    let whereClause = { userId };
    if (accountSetId) {
      whereClause.accountSetId = accountSetId;
    }

    const closedTrades = await ClosedTrade.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: AccountSet, 
          attributes: ['id', 'name', 'futureSymbol', 'spotSymbol']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      trades: closedTrades.rows,
      count: closedTrades.count,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: closedTrades.count > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── POST /api/trading/close-trade - Close an active trade ─────────
router.post('/close-trade', async (req, res) => {
  try {
    const { tradeId, reason = 'Manual' } = req.body;
    const userId = req.user.id;

    if (!tradeId) {
      return res.status(400).json({
        success: false,
        message: 'Trade ID is required'
      });
    }

    const result = await tradingService.closeTrade(tradeId, userId, reason);

    if (result.success) {
      return res.json({
        success: true,
        closedTrade: result.closedTrade,
        message: 'Trade closed successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── POST /api/trading/cancel-pending - Cancel a pending order ─────────
router.post('/cancel-pending', async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const pendingOrder = await PendingOrder.findOne({
      where: { orderId, userId, status: 'Pending' }
    });

    if (!pendingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Pending order not found'
      });
    }

    pendingOrder.status = 'Cancelled';
    await pendingOrder.save();

    res.json({
      success: true,
      message: 'Pending order cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── POST /api/trading/sync-trade-status - Manual trade status sync ─────────
router.post('/sync-trade-status', async (req, res) => {
  try {
    const tradeStatusMonitor = require('../services/tradeStatusMonitor');
    
    // Trigger manual check
    await tradeStatusMonitor.checkTradeStatuses();
    
    res.json({
      success: true,
      message: 'Trade status sync completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── POST /api/trading/cleanup-database - Manual database cleanup ─────────
router.post('/cleanup-database', async (req, res) => {
  try {
    const databaseCleanupService = require('../services/databaseCleanupService');
    
    // Trigger manual cleanup
    await databaseCleanupService.triggerCleanup();
    
    res.json({
      success: true,
      message: 'Database cleanup completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;