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
const realtimeTpMonitor = require('../services/realtimeTpMonitor');
const brokerStatusLogger = require('../utils/brokerStatusLogger');

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

    // ✅ DATABASE-FIRST: Use the broker symbol cache for speed and reliability
    const token = await getValidToken(broker, isMT5);
    const symbols = await brokerSymbolsCache.getSymbolsForBroker(
      broker.brokerName, broker.server, terminal, token
    );

    if (!symbols) {
      return res.status(404).json({ success: false, message: 'Could not fetch symbols.' });
    }

    // ✅ Log successful symbols operation
    const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(broker.brokerName, broker.server);
    brokerStatusLogger.logSuccess(
      'Unknown', // Account set name not available in this context
      normalizedBroker,
      broker.accountNumber,
      terminal,
      'symbols'
    );

    return res.json({ success: true, symbols });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 🚀 ULTRA-FAST: GET /api/trading/quote - Using persistent data collection for fastest data
router.get('/quote', async (req, res) => {
  const startTime = Date.now();
  let brokerId;
  
  try {
    const { terminal } = req.query;
    brokerId = extractBrokerId(req);
    const { symbol } = req.query;
    const isMT5 = terminal === 'MT5';
    const isAdmin = req.user.role === 'admin';
    const persistentDataCollection = require('../services/persistentDataCollection');
    
    const broker = await findBroker(brokerId, req.user.id, isAdmin);
    
    if (!broker) {
      return res.status(404).json({ success: false, message: 'Broker not found' });
    }

    // 🚀 FASTEST: Use the same system that feeds premium calculations (always fresh)
    const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(
      broker.brokerName, broker.server, broker.companyName
    );
    
    let quote = await persistentDataCollection.getQuoteFromBidAskTable(normalizedBroker, symbol);
    
    const cacheAge = quote ? persistentDataCollection.getQuoteAgeMs(quote) : 'N/A';
    console.log(`⚡ FASTEST QUOTE for ${normalizedBroker}/${symbol}: age=${cacheAge}ms`);
    
    // Only fallback to API if absolutely no data exists (should be rare)
    if (!quote) {
      console.log(`🌐 RARE FALLBACK: No data found for ${normalizedBroker}/${symbol}, fetching from API`);
      const token = await getValidToken(broker, isMT5);
      const client = isMT5 ? axiosMT5 : axiosMT4;
      
      const resp = await client.get('/GetQuote', { params: { id: token, symbol } });
      
      if (resp.data?.bid && resp.data?.ask) {
        quote = {
          bid: parseFloat(resp.data.bid),
          ask: parseFloat(resp.data.ask),
          symbol,
          timestamp: new Date(),
          source: 'api'
        };
        console.log(`✅ API quote fetched for ${normalizedBroker}/${symbol}: bid=${quote.bid}, ask=${quote.ask}`);
      }
    } else {
      quote.source = 'persistent_collection';
      console.log(`⚡ PERSISTENT DATA HIT: Ultra-fast quote for ${normalizedBroker}/${symbol}: age=${cacheAge}ms`);
    }
    
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record quote ping latency
    latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    
    // Log successful quote fetch to broker status
    if (quote) {
      brokerStatusLogger.logSuccess(
        broker.accountSet?.name || 'Unknown',
        broker.brokerName,
        broker.accountNumber,
        broker.terminal,
        'quote'
      );
    }
    
    return res.json({ 
      success: true, 
      data: { 
        ...quote, 
        latency,
        age: quote ? persistentDataCollection.getQuoteAgeMs(quote) : null,
        ultraFast: true
      }
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

// 🚀 ULTRA-FAST: GET /api/trading/quote/:symbol - Using persistent data collection for fastest data
router.get('/quote/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { terminal } = req.query;
  const brokerId = extractBrokerId(req);
  const isAdmin = req.user.role === 'admin';
  const persistentDataCollection = require('../services/persistentDataCollection');

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

    // 🚀 FASTEST: Use persistent data collection (same system as premium calculations)
    const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(
      broker.brokerName, broker.server, broker.companyName
    );
    
    let data = await persistentDataCollection.getQuoteFromBidAskTable(normalizedBroker, symbol);

    const cacheAge = data ? persistentDataCollection.getQuoteAgeMs(data) : 'N/A';
    console.log(`⚡ FASTEST QUOTE for ${normalizedBroker}/${symbol}: age=${cacheAge}ms`);

    // Only fallback to API if absolutely no data exists (should be extremely rare)
    if (!data) {
      console.log(`🌐 RARE FALLBACK: No data found for ${normalizedBroker}/${symbol}, fetching from API`);
      try {
        const mtToken = await getValidToken(broker, broker.terminal === 'MT5');
        
        const client = broker.terminal === 'MT5' ? axiosMT5 : axiosMT4;
        const response = await client.get('/GetQuote', {
          params: { id: mtToken, symbol }
        });

        if (response.data?.bid && response.data?.ask) {
          data = {
            bid: parseFloat(response.data.bid),
            ask: parseFloat(response.data.ask),
            symbol,
            timestamp: new Date(),
            source: 'api',
            age: 0
          };
          console.log(`✅ API quote fetched for ${normalizedBroker}/${symbol}: bid=${data.bid}, ask=${data.ask}`);
        }
      } catch (liveError) {
        console.log(`❌ API fallback failed for ${normalizedBroker}/${symbol}`);
        return res.status(404).json({
          success: false,
          message: 'Quote not available from any source'
        });
      }
    } else {
      data.source = 'persistent_collection';
      console.log(`⚡ PERSISTENT DATA HIT: Ultra-fast quote for ${normalizedBroker}/${symbol}: age=${cacheAge}ms`);
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Quote not available from any source'
      });
    }
    
    return res.json({ 
      success: true, 
      data: {
        ...data,
        cached: data.source !== 'api',
        age: persistentDataCollection.getQuoteAgeMs(data),
        ultraFast: true
      }
    });
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

    // Log successful balance fetch to broker status
    brokerStatusLogger.logSuccess(
      broker.accountSet?.name || 'Unknown',
      broker.brokerName,
      broker.accountNumber,
      broker.terminal,
      'balance'
    );

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
      
      // Log successful orders fetch to broker status
      brokerStatusLogger.logSuccess(
        broker.accountSet?.name || 'Unknown',
        broker.brokerName,
        broker.accountNumber,
        broker.terminal,
        'orders'
      );
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

// 🚀 ULTRA-FAST: MT5 quote with persistent data collection
router.get('/mt5-quote/:symbol', async (req, res) => {
  const startTime = Date.now();
  let brokerId;
  
  try {
    const { symbol } = req.params;
    const user = await User.findByPk(req.user.id);
    const tradingAccounts = user.tradingAccounts || [];
    const mt5Account = tradingAccounts.find(acc => acc.terminal === 'MT5');
    const persistentDataCollection = require('../services/persistentDataCollection');
    brokerId = mt5Account?.id;
    
    if (!mt5Account?.token) {
      return res.status(400).json({ error: 'MT5 account not linked' });
    }

    // 🚀 FASTEST: Try persistent data collection first
    let quote = null;
    try {
      // For legacy MT5 accounts, try to get quote from persistent data collection
      if (mt5Account.brokerName) {
        const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(mt5Account.brokerName);
        quote = await persistentDataCollection.getQuoteFromBidAskTable(normalizedBroker, symbol);
      }
    } catch (cacheError) {
      // Continue to API
    }

    // Only call API if absolutely no data exists
    if (!quote) {
      const response = await axiosMT5.get('/GetQuote', {params: { id: mt5Account.token, symbol }});
      
      if (response.data?.Bid && response.data?.Ask) {
        quote = {
          Bid: response.data.Bid,
          Ask: response.data.Ask,
          symbol,
          timestamp: new Date(),
          source: 'api'
        };
      }
    } else {
      quote.source = 'persistent_collection';
    }

    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record quote ping latency
    if (brokerId) {
      latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    }
    
    res.json({ 
      ...quote, 
      latency,
      age: quote ? persistentDataCollection.getQuoteAgeMs(quote) : null,
      ultraFast: true
    });
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

// 🚀 ULTRA-FAST: MT4 quote with persistent data collection
router.get('/mt4-quote/:symbol', async (req, res) => {
  const startTime = Date.now();
  let brokerId;
  
  try {
    const { symbol } = req.params;
    const user = await User.findByPk(req.user.id);
    const tradingAccounts = user.tradingAccounts || [];
    const mt4Account = tradingAccounts.find(acc => acc.terminal === 'MT4');
    const persistentDataCollection = require('../services/persistentDataCollection');
    brokerId = mt4Account?.id;
    
    if (!mt4Account?.token) {
      return res.status(400).json({ error: 'MT4 account not linked' });
    }

    // 🚀 FASTEST: Try persistent data collection first
    let quote = null;
    try {
      // For legacy MT4 accounts, try to get quote from persistent data collection
      if (mt4Account.brokerName) {
        const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(mt4Account.brokerName);
        quote = await persistentDataCollection.getQuoteFromBidAskTable(normalizedBroker, symbol);
      }
    } catch (cacheError) {
      // Continue to API
    }

    // Only call API if absolutely no data exists
    if (!quote) {
      const response = await axiosMT4.get('/GetQuote', {params: { id: mt4Account.token, symbol }});
      
      if (response.data?.Bid && response.data?.Ask) {
        quote = {
          Bid: response.data.Bid,
          Ask: response.data.Ask,
          symbol,
          timestamp: new Date(),
          source: 'api'
        };
      }
    } else {
      quote.source = 'persistent_collection';
    }

    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record quote ping latency
    if (brokerId) {
      latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    }
    
    res.json({ 
      ...quote, 
      latency,
      age: quote ? persistentDataCollection.getQuoteAgeMs(quote) : null,
      ultraFast: true
    });
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
      takeProfitMode,
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

    console.log('📈 Starting trade execution at current premium:', {
      accountSetId,
      userId: req.user.id,
      direction,
      volume: volumeNum,
      takeProfit,
      stopLoss,
      scalpingMode,
      comment
    });
    
    // Execute trade with timeout
    const result = await Promise.race([
      tradingService.executeAtCurrentPremium({
        accountSetId,
        userId: req.user.id,
        direction,
        volume: volumeNum,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        takeProfitMode: takeProfitMode || 'None',
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        scalpingMode: scalpingMode || false,
        comment: comment || 'FluxNetwork Trade'
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Trade execution timeout after 60 seconds')), 60000)
      )
    ]);
    
    console.log('✅ Trade execution result:', result);

    if (result.success) {
      console.log('✅ Trade execution completed successfully:', {
        tradeId: result.trade.tradeId,
        broker1Ticket: result.trade.broker1Ticket,
        broker2Ticket: result.trade.broker2Ticket,
        accountSetId: result.trade.accountSetId,
        userId: result.trade.userId,
        status: result.trade.status
      });
      
      // Add to real-time TP monitoring if TP is set
      if (takeProfitMode && takeProfitMode !== 'None' && takeProfit) {
        await realtimeTpMonitor.addTradeToMonitoring(result.trade.tradeId);
        console.log(`➕ Added new trade ${result.trade.tradeId} to real-time TP monitoring`);
      }
      
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
    console.error('❌ Execute-current failed:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
      takeProfitMode,
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
      takeProfitMode: takeProfitMode || 'None',
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
    const { brokerId, terminal, symbol } = req.body;
    
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

    // Only get trades with 'Active' or 'PartiallyFilled' status
    whereClause.status = ['Active', 'PartiallyFilled'];

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
    
    // Allow filtering by status, default to 'Pending' for backward compatibility
    const statusFilter = req.query.status || 'Pending';
    const validStatuses = ['Pending', 'Filled', 'Cancelled', 'Expired', 'Error'];
    
    let whereClause = { userId };
    if (statusFilter === 'all') {
      // Show all statuses
    } else if (validStatuses.includes(statusFilter)) {
      whereClause.status = statusFilter;
    } else {
      whereClause.status = 'Pending'; // Default fallback
    }
    
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

// ─── POST /api/trading/close-trade-external - Close trade via external API ─────────
router.post('/close-trade-external', async (req, res) => {
  try {
    const { tradeId, closeResults, reason = 'Manual' } = req.body;
    const userId = req.user.id;

    if (!tradeId || !closeResults) {
      return res.status(400).json({
        success: false,
        message: 'Trade ID and close results are required'
      });
    }

    // Get the active trade
    const activeTrade = await ActiveTrade.findOne({
      where: { tradeId, userId },
      include: [
        { model: Broker, as: 'broker1' },
        { model: Broker, as: 'broker2' }
      ]
    });

    if (!activeTrade) {
      return res.status(404).json({
        success: false,
        message: 'Active trade not found'
      });
    }

    // Extract close data from external API responses
    let broker1CloseData = null;
    let broker2CloseData = null;
    let totalProfit = 0;

    closeResults.forEach(result => {
      if (result.success && result.data) {
        if (result.broker === 'Broker 1') {
          broker1CloseData = result.data;
          totalProfit += parseFloat(result.data.profit) || 0;
        } else if (result.broker === 'Broker 2') {
          broker2CloseData = result.data;
          totalProfit += parseFloat(result.data.profit) || 0;
        }
      }
    });

    // Calculate trade duration
    const tradeDurationMinutes = Math.floor(
      (Date.now() - new Date(activeTrade.createdAt).getTime()) / (1000 * 60)
    );

    // Create closed trade record
    const closedTrade = await ClosedTrade.create({
      tradeId: activeTrade.tradeId,
      accountSetId: activeTrade.accountSetId,
      userId: activeTrade.userId,
      
      broker1Id: activeTrade.broker1Id,
      broker1Ticket: activeTrade.broker1Ticket,
      broker1Symbol: activeTrade.broker1Symbol,
      broker1Direction: activeTrade.broker1Direction,
      broker1Volume: activeTrade.broker1Volume,
      broker1OpenPrice: activeTrade.broker1OpenPrice,
      broker1ClosePrice: broker1CloseData?.closePrice || 0,
      broker1OpenTime: activeTrade.broker1OpenTime,
      broker1Profit: broker1CloseData?.profit || 0,
      
      broker2Id: activeTrade.broker2Id,
      broker2Ticket: activeTrade.broker2Ticket,
      broker2Symbol: activeTrade.broker2Symbol,
      broker2Direction: activeTrade.broker2Direction,
      broker2Volume: activeTrade.broker2Volume,
      broker2OpenPrice: activeTrade.broker2OpenPrice,
      broker2ClosePrice: broker2CloseData?.closePrice || 0,
      broker2OpenTime: activeTrade.broker2OpenTime,
      broker2Profit: broker2CloseData?.profit || 0,
      
      executionPremium: activeTrade.executionPremium,
      closePremium: 0, // Could be calculated if needed
      totalProfit: totalProfit,
      takeProfit: activeTrade.takeProfit,
      takeProfitMode: activeTrade.takeProfitMode || 'None',
      stopLoss: activeTrade.stopLoss,
      closeReason: reason,
      tradeDurationMinutes,
      
      broker1Latency: activeTrade.broker1Latency,
      broker2Latency: activeTrade.broker2Latency,
      comment: activeTrade.comment,
      scalpingMode: activeTrade.scalpingMode
    });

    // Remove from active trades
    await activeTrade.destroy();

    res.json({
      success: true,
      closedTrade,
      closeResults,
      message: 'Trade closed successfully via external API'
    });

  } catch (error) {
    console.error('Error closing trade externally:', error);
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

// ─── GET /api/trading/symbols-cache-status - Get symbols cache status ─────────
router.get('/symbols-cache-status', async (req, res) => {
  try {
    const stats = await brokerSymbolsCache.getCacheStats();
    
    res.json({
      success: true,
      cacheStats: stats,
      message: `Found ${stats.totalCachedBrokers} cached brokers with ${stats.inMemoryCache} in-memory entries`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── POST /api/trading/populate-symbols-cache - Force populate symbols cache ─────────
router.post('/populate-symbols-cache', async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // Get all account sets for the user
    let whereClause = {};
    if (!isAdmin) {
      whereClause.userId = userId;
    }
    
    const accountSets = await AccountSet.findAll({
      where: whereClause,
      include: [{
        model: Broker,
        as: 'brokers'
      }]
    });
    
    const results = [];
    
    for (const accountSet of accountSets) {
      for (const broker of accountSet.brokers) {
        try {
          const token = await getValidToken(broker, broker.terminal === 'MT5');
          const symbols = await brokerSymbolsCache.getSymbolsForBroker(
            broker.brokerName,
            broker.server,
            broker.terminal,
            token
          );
          
          results.push({
            accountSetName: accountSet.name,
            brokerId: broker.id,
            brokerName: broker.brokerName,
            terminal: broker.terminal,
            server: broker.server,
            symbolsCount: Array.isArray(symbols) ? symbols.length : Object.keys(symbols || {}).length,
            cached: true
          });
        } catch (error) {
          results.push({
            accountSetName: accountSet.name,
            brokerId: broker.id,
            brokerName: broker.brokerName,
            terminal: broker.terminal,
            server: broker.server,
            error: error.message,
            cached: false
          });
        }
      }
    }
    
    res.json({
      success: true,
      results,
      message: `Processed ${results.length} brokers`
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
    const { accountSetId } = req.query;
    const userId = req.user.id;
    
    let whereClause = { userId };
    if (accountSetId) {
      whereClause.accountSetId = accountSetId;
    }

    const closedTrades = await ClosedTrade.findAll({
      where: whereClause,
      include: [
        { 
          model: AccountSet,
          as: 'accountSet',
          attributes: ['id', 'name', 'futureSymbol', 'spotSymbol']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50 // Limit to recent 50 closed trades
    });

    res.json({
      success: true,
      trades: closedTrades
    });

  } catch (error) {
    console.error('Error fetching closed trades:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ─── GET /api/trading/debug-active-trades - Debug active trades in database ─────────
router.get('/debug-active-trades', async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountSetId } = req.query;
    
    // Get ALL active trades regardless of status for debugging
    let whereClause = { userId };
    if (accountSetId) {
      whereClause.accountSetId = accountSetId;
    }

    const allActiveTrades = await ActiveTrade.findAll({
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

    // Also get counts by status
    const statusCounts = await ActiveTrade.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('status')), 'count']
      ],
      where: { userId },
      group: ['status'],
      raw: true
    });

    // Get the most recent 5 trades for detailed analysis
    const recentTrades = allActiveTrades.slice(0, 5).map(t => ({
      tradeId: t.tradeId,
      status: t.status,
      createdAt: t.createdAt,
      broker1Ticket: t.broker1Ticket,
      broker2Ticket: t.broker2Ticket,
      accountSetId: t.accountSetId,
      broker1Symbol: t.broker1Symbol,
      broker2Symbol: t.broker2Symbol,
      direction: t.direction,
      volume: t.volume
    }));

    res.json({
      success: true,
      debug: {
        totalTradesInActiveTable: allActiveTrades.length,
        statusBreakdown: statusCounts,
        recentTrades,
        queryTime: new Date().toISOString(),
        userId: req.user.id,
        accountSetFilter: accountSetId || 'None'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── POST /api/trading/force-cleanup - Force cleanup of specific trade ─────────
router.post('/force-cleanup', async (req, res) => {
  try {
    const { tradeId } = req.body;
    const userId = req.user.id;

    if (!tradeId) {
      return res.status(400).json({
        success: false,
        message: 'Trade ID is required'
      });
    }

    const trade = await ActiveTrade.findOne({
      where: { tradeId, userId }
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found in active trades'
      });
    }

    const transaction = await ActiveTrade.sequelize.transaction();
    
    try {
      // Check if already exists in closed trades
      const existingClosed = await ClosedTrade.findOne({
        where: { tradeId }
      });

      if (!existingClosed) {
        // Create closed trade record
        await ClosedTrade.create({
          tradeId: trade.tradeId,
          accountSetId: trade.accountSetId,
          userId: trade.userId,
          
          // Broker 1 details
          broker1Id: trade.broker1Id,
          broker1Ticket: trade.broker1Ticket,
          broker1Symbol: trade.broker1Symbol,
          broker1Direction: trade.broker1Direction,
          broker1Volume: trade.broker1Volume,
          broker1OpenPrice: trade.broker1OpenPrice,
          broker1OpenTime: trade.broker1OpenTime,
          broker1CloseTime: new Date(),
          
          // Broker 2 details
          broker2Id: trade.broker2Id,
          broker2Ticket: trade.broker2Ticket,
          broker2Symbol: trade.broker2Symbol,
          broker2Direction: trade.broker2Direction,
          broker2Volume: trade.broker2Volume,
          broker2OpenPrice: trade.broker2OpenPrice,
          broker2OpenTime: trade.broker2OpenTime,
          broker2CloseTime: new Date(),
          
          // Trade details
          executionPremium: trade.executionPremium,
          closePremium: trade.executionPremium,
          takeProfit: trade.takeProfit,
          takeProfitMode: trade.takeProfitMode || 'None',
          stopLoss: trade.stopLoss,
          broker1Latency: trade.broker1Latency,
          broker2Latency: trade.broker2Latency,
          comment: trade.comment,
          scalpingMode: trade.scalpingMode,
          
          // Close details
          closeReason: 'Manual force cleanup',
          totalProfit: 0
        }, { transaction });
      }

      // Remove from active trades
      await trade.destroy({ transaction });
      
      await transaction.commit();

      res.json({
        success: true,
        message: `Trade ${tradeId} has been moved to closed trades`
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ─── PUT /api/trading/update-tp - Update take profit for an active trade ─────────
router.put('/update-tp', async (req, res) => {
  try {
    const { tradeId, takeProfit, takeProfitMode } = req.body;
    const userId = req.user.id;

    if (!tradeId) {
      return res.status(400).json({
        success: false,
        message: 'Trade ID is required'
      });
    }

    // Validate takeProfitMode
    const validModes = ['None', 'Premium', 'Amount'];
    if (takeProfitMode && !validModes.includes(takeProfitMode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid take profit mode. Must be None, Premium, or Amount'
      });
    }

    // Find the active trade
    const trade = await ActiveTrade.findOne({
      where: { tradeId, userId }
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Active trade not found'
      });
    }

    // Update the trade with new TP values
    trade.takeProfit = takeProfit;
    trade.takeProfitMode = takeProfitMode || 'None';
    await trade.save();

    // Add to or remove from real-time TP monitoring
    if (takeProfitMode && takeProfitMode !== 'None' && takeProfit) {
      await realtimeTpMonitor.addTradeToMonitoring(trade.tradeId);
      console.log(`➕ Added trade ${trade.tradeId} to real-time TP monitoring`);
    } else {
      realtimeTpMonitor.removeTradeFromMonitoring(trade.tradeId);
      console.log(`➖ Removed trade ${trade.tradeId} from real-time TP monitoring`);
    }

    res.json({
      success: true,
      trade: {
        tradeId: trade.tradeId,
        takeProfit: trade.takeProfit,
        takeProfitMode: trade.takeProfitMode
      },
      message: 'Take profit updated successfully'
    });

  } catch (error) {
    console.error('Error updating take profit:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// 🚀 ULTRA-FAST: Batch quotes endpoint using persistent data collection
router.post('/quotes/batch', async (req, res) => {
  try {
    const { requests } = req.body;
    const isAdmin = req.user.role === 'admin';
    const persistentDataCollection = require('../services/persistentDataCollection');

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'requests array is required'
      });
    }

    if (requests.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 20 quote requests per batch'
      });
    }

    const results = await Promise.all(requests.map(async (request) => {
      try {
        const { symbol, terminal, brokerId } = request;
        
        if (!symbol || !terminal || !brokerId) {
          return {
            symbol,
            terminal,
            brokerId,
            success: false,
            error: 'Missing required fields'
          };
        }

        const broker = await findBroker(brokerId, req.user.id, isAdmin);
        if (!broker) {
          return {
            symbol,
            terminal,
            brokerId,
            success: false,
            error: 'Broker not found'
          };
        }

        // 🚀 FASTEST: Use persistent data collection (same system as premium calculations)
        const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(
          broker.brokerName, broker.server, broker.companyName
        );
        
        let quote = await persistentDataCollection.getQuoteFromBidAskTable(normalizedBroker, symbol);

        const cacheAge = quote ? persistentDataCollection.getQuoteAgeMs(quote) : 'N/A';
        console.log(`⚡ BATCH FASTEST for ${normalizedBroker}/${symbol}: age=${cacheAge}ms`);

        // Only call API if absolutely no data exists (should be extremely rare)
        if (!quote) {
          console.log(`🌐 BATCH RARE FALLBACK: No data found for ${normalizedBroker}/${symbol}, fetching from API`);
          try {
            const token = await getValidToken(broker, terminal === 'MT5');
            const client = terminal === 'MT5' ? axiosMT5 : axiosMT4;
            
            const response = await client.get('/GetQuote', {
              params: { id: token, symbol },
              timeout: 5000
            });

            if (response.data?.bid && response.data?.ask) {
              quote = {
                bid: parseFloat(response.data.bid),
                ask: parseFloat(response.data.ask),
                symbol,
                timestamp: new Date(),
                source: 'api',
                age: 0
              };
              console.log(`✅ Batch API quote fetched for ${normalizedBroker}/${symbol}: bid=${quote.bid}, ask=${quote.ask}`);
            }
          } catch (apiError) {
            console.log(`❌ Batch API fallback failed for ${normalizedBroker}/${symbol}`);
            // No fallback to stale data - either fresh or nothing
          }
        } else {
          console.log(`⚡ BATCH PERSISTENT HIT: Ultra-fast quote for ${normalizedBroker}/${symbol}: age=${cacheAge}ms`);
        }

        if (!quote) {
          return {
            symbol,
            terminal,
            brokerId,
            success: false,
            error: 'Quote not available'
          };
        }

        // ✅ Log successful quote fetch to broker status
        brokerStatusLogger.logSuccess(
          broker.accountSet?.name || 'Unknown',
          broker.brokerName,
          broker.accountNumber,
          broker.terminal,
          'quote'
        );

        return {
          symbol,
          terminal,
          brokerId,
          success: true,
          data: {
            ...quote,
            cached: quote.source !== 'api',
            age: persistentDataCollection.getQuoteAgeMs(quote),
            ultraFast: true
          },
          brokerInfo: {
            accountSetName: broker.accountSet?.name,
            brokerName: broker.brokerName,
            accountNumber: broker.accountNumber,
            terminal: broker.terminal
          }
        };

      } catch (error) {
        return {
          symbol: request.symbol,
          terminal: request.terminal,
          brokerId: request.brokerId,
          success: false,
          error: error.message
        };
      }
    }));

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      data: results,
      meta: {
        total: requests.length,
        successful: successCount,
        failed: requests.length - successCount
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch batch quotes'
    });
  }
});

// ✅ NEW: Batch symbols endpoint for efficient frontend requests
router.post('/symbols/batch', async (req, res) => {
  try {
    const { requests } = req.body;
    const isAdmin = req.user.role === 'admin';

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'requests array is required'
      });
    }

    if (requests.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 symbol requests per batch'
      });
    }

    const results = await Promise.all(requests.map(async (request) => {
      try {
        const { terminal, brokerId } = request;
        
        if (!terminal || !brokerId) {
          return {
            brokerId,
            terminal,
            success: false,
            error: 'Missing required fields'
          };
        }

        if (!['MT4', 'MT5'].includes(terminal)) {
          return {
            brokerId,
            terminal,
            success: false,
            error: 'Invalid terminal (must be MT4 or MT5)'
          };
        }

        const broker = await findBroker(brokerId, req.user.id, isAdmin);
        if (!broker) {
          return {
            brokerId,
            terminal,
            success: false,
            error: 'Broker not found'
          };
        }

        // ✅ Use the cached symbols service with better error handling
        let token;
        try {
          token = await getValidToken(broker, terminal === 'MT5');
        } catch (tokenErr) {
          console.error(`❌ Token error for ${brokerId} (${terminal}):`, tokenErr.message);
          return {
            brokerId,
            terminal,
            success: false,
            error: `Token error: ${tokenErr.message}`
          };
        }

        const symbols = await brokerSymbolsCache.getSymbolsForBroker(
          broker.brokerName, broker.server, terminal, token
        );

        console.log(`📊 Batch symbols result for ${brokerId} (${terminal}): ${symbols ? Object.keys(symbols).length || 0 : 0} symbols`);

        if (!symbols) {
          return {
            brokerId,
            terminal,
            success: false,
            error: 'Could not fetch symbols from cache or API'
          };
        }

        return {
          brokerId,
          terminal,
          success: true,
          data: {
            symbols,
            brokerName: broker.brokerName,
            source: 'cached' // Always from cache system
          }
        };

      } catch (error) {
        return {
          brokerId: request.brokerId,
          terminal: request.terminal,
          success: false,
          error: error.message
        };
      }
    }));

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      data: results,
      meta: {
        total: requests.length,
        successful: successCount,
        failed: requests.length - successCount,
        source: 'batch_cached'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch batch symbols'
    });
  }
});

module.exports = router;