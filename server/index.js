require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const morgan = require('morgan');
const { syncDatabase } = require('./models');
const { AccountSet, Broker } = require('./models/AccountSet');
const { TokenManager } = require('./token-manager');
const https = require('https');
const axios = require('axios');
const cleanupExpiredData = require('./cleanup-expired-data');
const persistentDataCollectionService = require('./services/persistentDataCollection');
const premiumRoutes = require('./routes/premium');
const logger = require('./utils/logger');
const latencyMonitor = require('./services/latencyMonitor');
const pendingOrderMonitor = require('./services/pendingOrderMonitor');
const tradeStatusMonitor = require('./services/tradeStatusMonitor');
const databaseCleanupService = require('./services/databaseCleanupService');

const API_TIMEOUT = 25000;
const httpsAgent = new https.Agent({ 
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: API_TIMEOUT
});

// ─── Broker gateway clients ───────────────────────────────────
const mt4Client = axios.create({
  baseURL: process.env.MT4_API_URL,
  timeout: API_TIMEOUT,
  httpsAgent
});

const mt5Client = axios.create({
  baseURL: process.env.MT5_API_URL,
  timeout: API_TIMEOUT,
  httpsAgent
});

async function makeAPIRequest(path, options = {}, retries = 2) {
  const { isMT5 = false } = options;
  const client = isMT5 ? mt5Client : mt4Client;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const { data } = await client.get(path);
      return data;
    } catch (error) {
      const isRetryable = error.code === 'ECONNABORTED' || 
                         error.code === 'ETIMEDOUT' ||
                         error.code === 'ECONNRESET';
      
      if (attempt > retries || !isRetryable) {
        throw error;
      }
      
      const delay = 1000 * attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

const circuitBreaker = {
  failures: new Map(),
  threshold: 5,
  timeout: 60000,
  
  isOpen(brokerId) {
    const failures = this.failures.get(brokerId);
    if (!failures) return false;
    
    if (failures.count >= this.threshold) {
      if (Date.now() - failures.lastFailure < this.timeout) {
        return true;
      } else {
        this.failures.delete(brokerId);
        return false;
      }
    }
    return false;
  },
  
  recordFailure(brokerId) {
    const failures = this.failures.get(brokerId) || { count: 0, lastFailure: 0 };
    failures.count++;
    failures.lastFailure = Date.now();
    this.failures.set(brokerId, failures);
  },
  
  recordSuccess(brokerId) {
    this.failures.delete(brokerId);
  }
};

const app = express();
global.app = app; // Make app available globally for services

// Morgan format config
const morganFormat =
  process.env.NODE_ENV === 'production'
    ? 'combined'
    : 'dev';

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Allow localhost and various tunneling services
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5000',
      /^https:\/\/.*\.githubpreview\.dev$/,
      /^https:\/\/.*\.github\.dev$/,
      /^https:\/\/.*\.app\.github\.dev$/,
      /^https:\/\/.*\.devtunnels\.ms$/,
      /^https:\/\/.*\.inc1\.devtunnels\.ms$/
    ];
    
    const isAllowed = allowedOrigins.some(allowed => {
      return typeof allowed === 'string' ? allowed === origin : allowed.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow for now, can be stricter in production
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        logger.info(message.trim());
      }
    }
  })
);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/otp'));
app.use('/api/users', require('./routes/user'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/account-sets', require('./routes/accountSets'));
app.use('/api/trading', require('./routes/status'));
app.use('/api/trading', require('./middleware/auth'), require('./routes/trading'));
app.use('/api/mt4mt5', require('./routes/mt4mt5Proxy'));
app.use('/api', premiumRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('Flux Network API is running');
});

app.get('/api/health', async (req, res) => {
  try {
    const mt4Available = await checkApiHealth(mt4Client);
    const mt5Available = await checkApiHealth(mt5Client);
    
    res.json({
      status: 'healthy',
      apis: {
        mt4: mt4Available ? 'available' : 'unavailable',
        mt5: mt5Available ? 'available' : 'unavailable'
      },
      circuitBreaker: {
        openBreakers: Array.from(circuitBreaker.failures.keys()).length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

async function checkApiHealth(client) {
  try {
    // Primary: Try ConnectEx first
    await client.get('/ConnectEx', {
      params: { user: '0', password: '0', server: 'test' },
      timeout: 5000
    });
    return true;
  } catch (error) {
    // Fallback: Try original Connect endpoint
    try {
      await client.get('/Connect', {
        params: { user: '0', password: '0', host: 'test' },
        timeout: 5000
      });
      return true;
    } catch (fallbackError) {
      return error.response || fallbackError.response ? true : false;
    }
  }
}

// Data collection status
app.get('/api/data-collection/status', (req, res) => {
  const status = persistentDataCollectionService.getCollectionStatus();
  res.json({
    success: true,
    activeCollections: status.length,
    collections: status
  });
});

// Latency monitoring endpoints
app.get('/api/trading/latency/:brokerId', async (req, res) => {
  try {
    const { brokerId } = req.params;
    
    const orderSendStats = latencyMonitor.getLatencyStats(brokerId, 'orderSend');
    const quotePingStats = latencyMonitor.getLatencyStats(brokerId, 'quotePing');
    
    res.json({
      success: true,
      data: {
        brokerId,
        orderSend: orderSendStats,
        quotePing: quotePingStats,
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/trading/test-latency', async (req, res) => {
  try {
    const { brokerId, terminal, symbol, token } = req.body;
    
    if (!brokerId || !terminal) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: brokerId, terminal'
      });
    }
    
    // Test OrderSend latency
    const orderSendResult = await latencyMonitor.testOrderSendEndpoint(terminal, brokerId, {
      id: token,
      symbol: symbol || 'EURUSD'
    });
    
    if (orderSendResult.success || orderSendResult.latency) {
      latencyMonitor.addLatencyRecord(brokerId, 'orderSend', orderSendResult.latency);
    }
    
    // Test quote ping if token and symbol provided
    let quotePingResult = null;
    if (token && symbol) {
      quotePingResult = await latencyMonitor.measureQuotePing(terminal, brokerId, symbol, token);
      if (quotePingResult.success || quotePingResult.latency) {
        latencyMonitor.addLatencyRecord(brokerId, 'quotePing', quotePingResult.latency);
      }
    }
    
    res.json({
      success: true,
      data: {
        orderSend: {
          latency: orderSendResult.latency,
          success: orderSendResult.success
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

// Server setup
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ==================== MINIMAL WEBSOCKET SERVER ====================
const wss = new WebSocket.Server({ server, path: '/ws' });

// Client subscriptions: Map<accountSetId, Set<WebSocket>>
const subscriptions = new Map();

// Helper: Add client to account set subscription
function subscribeClient(ws, accountSetId) {
  if (!subscriptions.has(accountSetId)) {
    subscriptions.set(accountSetId, new Set());
  }
  subscriptions.get(accountSetId).add(ws);
  ws.accountSetId = accountSetId;
}

// Helper: Remove client from subscriptions
function unsubscribeClient(ws) {
  if (ws.accountSetId && subscriptions.has(ws.accountSetId)) {
    subscriptions.get(ws.accountSetId).delete(ws);
    if (subscriptions.get(ws.accountSetId).size === 0) {
      subscriptions.delete(ws.accountSetId);
    }
  }
}

// Helper: Broadcast to account set subscribers
function broadcastToAccountSet(accountSetId, message) {
  const clients = subscriptions.get(accountSetId);
  if (!clients) return;
  
  const data = JSON.stringify(message);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

// Helper: Get valid token for broker
async function getValidBrokerToken(broker, forceRefresh = false) {
  const now = Date.now();
  const tokenValid = broker.token && 
                    broker.tokenExpiresAt && 
                    new Date(broker.tokenExpiresAt).getTime() > now;
  
  if (tokenValid && !forceRefresh) {
    return broker.token;
  }
  
  console.log(`🔄 ${forceRefresh ? 'Forced refresh' : 'Getting new'} token for broker ${broker.terminal} - ${broker.server}`);
  
  // Invalidate TokenManager cache if forcing refresh due to token error
  if (forceRefresh && broker.token) {
    const cacheKey = TokenManager._generateKey(
      broker.terminal === 'MT5',
      broker.server,
      broker.accountNumber,
      broker.id
    );
    TokenManager.invalidateToken(cacheKey);
  }
  
  const token = await TokenManager.getToken(
    broker.terminal === 'MT5',
    broker.server,
    broker.accountNumber,
    broker.password,
    broker.id
  );
  
  broker.token = token;
  broker.tokenExpiresAt = new Date(Date.now() + 22 * 60 * 60 * 1000);
  await broker.save();
  
  return token;
}

// Helper: Fetch quote from MT4/MT5 with latency monitoring
async function fetchQuote(token, symbol, terminal, brokerId = null) {
  const startTime = Date.now();
  
  try {
    const response = await makeAPIRequest(`/GetQuote?id=${token}&symbol=${symbol}`, {
      isMT5: terminal === 'MT5'
    });

    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record latency if brokerId provided
    if (brokerId) {
      latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    }

    if (response && response.bid && response.ask) {
      return {
        bid: parseFloat(response.bid),
        ask: parseFloat(response.ask),
        symbol,
        timestamp: new Date(),
        latency
      };
    }
    return null;
  } catch (error) {
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record latency even for failed requests if brokerId provided
    if (brokerId) {
      latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    }
    
    // Check if error is related to invalid token
    if (error.response && error.response.status === 400 && error.response.data) {
      const errorMsg = error.response.data.toString();
      if (errorMsg.includes('not found in Database') || 
          errorMsg.includes('not Connected') || 
          (errorMsg.includes('invalid') && !errorMsg.includes('Invalid symbol')) ||
          (errorMsg.includes('Invalid') && !errorMsg.includes('Invalid symbol')) ||
          errorMsg.includes('expired') ||
          errorMsg.includes('authorization failed') ||
          errorMsg.includes('login failed')) {
        console.log(`🔄 Token invalid detected: ${errorMsg}`);
        throw new Error('TOKEN_INVALID');
      }
    }
    throw error;
  }
}

async function fetchBalanceAndPositions(broker) {
  if (circuitBreaker.isOpen(broker.id)) {
    throw new Error(`Circuit breaker open for broker ${broker.id}`);
  }
  
  try {
    const token = await getValidBrokerToken(broker);

    const balanceRes = await makeAPIRequest(`/AccountSummary?id=${token}`, {
      isMT5: broker.terminal === 'MT5'
    });
    
    circuitBreaker.recordSuccess(broker.id);

    return {
      balance: balanceRes,
      positions: []
    };
  } catch (error) {
    // Handle token invalid errors by refreshing tokens
    if (error.response && error.response.status === 400 && error.response.data) {
      const errorMsg = error.response.data.toString();
      if (errorMsg.includes('not found in Database') || 
          errorMsg.includes('not Connected') || 
          errorMsg.includes('invalid') ||
          errorMsg.includes('Invalid') ||
          errorMsg.includes('expired')) {
          try {
            console.log('🔄 Token invalid for balance fetch, refreshing token...');
            const newToken = await getValidBrokerToken(broker, true);
            
            const balanceRes = await makeAPIRequest(`/AccountSummary?id=${newToken}`, {
              isMT5: broker.terminal === 'MT5'
            });
            
            circuitBreaker.recordSuccess(broker.id);
            console.log('✅ Balance fetch successful after token refresh');
            
            return {
              balance: balanceRes,
              positions: []
            };
          } catch (retryError) {
            console.error('❌ Balance fetch failed even after token refresh:', retryError);
            circuitBreaker.recordFailure(broker.id);
            throw retryError;
          }
        }
    }
    
    circuitBreaker.recordFailure(broker.id);
    throw error;
  }
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('🔗 New WebSocket connection from:', req.connection.remoteAddress);
  
  // Set up connection tracking
  ws.isAlive = true;
  ws.lastPing = Date.now();
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connection',
    data: { message: 'WebSocket connected successfully' }
  }));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      console.log('📨 Received WebSocket message:', msg);
      
      // Handle ping from client for heartbeat
      if (msg.action === 'ping') {
        ws.isAlive = true;
        ws.lastPing = Date.now();
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }
      
      switch (msg.action) {
        case 'subscribe_set':
          console.log('🔔 Handling subscribe_set');
          await handleSubscribeSet(ws, msg);
          break;
          
        case 'subscribe_quote':
          console.log('🔔 Handling subscribe_quote');
          await handleSubscribeQuote(ws, msg);
          break;

        // ─── NEW: Premium subscription ───────────────────────────
        case 'subscribe_premium':
          console.log('🔔 Handling subscribe_premium');
          await handleSubscribePremium(ws, msg);
          break;

        case 'subscribe_positions':
          console.log('🔔 Handling subscribe_positions');
          await handleSubscribePositions(ws, msg);
          break;

        case 'subscribe_trades':
          console.log('🔔 Handling subscribe_trades (not implemented)');
          break;
          
        case 'subscribe_news':
          console.log('🔔 Handling subscribe_news (not implemented)');
          break;
          
        default:
          console.warn('⚠ Unknown WebSocket action:', msg.action);
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: `Unknown action: ${msg.action}` }
          }));
      }
    } catch (error) {
      console.error('❌ WebSocket message parsing error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Invalid message format' }
      }));
    }
  });

  ws.on('close', (code, reason) => {
    console.log('🔌 WebSocket connection closed:', code, reason.toString());
    unsubscribeClient(ws);
    if (ws.quoteInterval) {
      clearInterval(ws.quoteInterval);
      console.log('🛑 Cleared quote interval');
    }
    if (ws.balanceInterval) {
      clearInterval(ws.balanceInterval);
      console.log('🛑 Cleared balance interval');
    }
    if (ws.premiumInterval) {
      clearInterval(ws.premiumInterval);
      console.log('🛑 Cleared premium interval');
    }
    if (ws.positionsInterval) {
      clearInterval(ws.positionsInterval);
      console.log('🛑 Cleared positions interval');
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
  
  ws.on('pong', () => {
    ws.isAlive = true;
    ws.lastPing = Date.now();
  });
});

// WebSocket health check - ping inactive connections
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log('🔌 Terminating inactive WebSocket connection');
      return ws.terminate();
    }
    
    // Check if connection has been inactive for too long
    const now = Date.now();
    if (now - ws.lastPing > 60000) { // 60 seconds of inactivity
      console.log('💔 WebSocket connection inactive, sending ping');
      ws.isAlive = false;
      ws.ping();
    }
  });
}, 30000); // Check every 30 seconds

// Cleanup ping interval on server close
wss.on('close', () => {
  clearInterval(pingInterval);
});

// Handle account set subscription for balance/positions
async function handleSubscribeSet(ws, msg) {
  const accountSetId = msg.accountSetId ?? msg.setId;
  console.log('🎯 handleSubscribeSet called with:', { accountSetId });
  
  if (!accountSetId) {
    console.error('❌ No accountSetId provided');
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'accountSetId is required' }
    }));
    return;
  }

  try {
    subscribeClient(ws, accountSetId);
    console.log('✅ Client subscribed to account set:', accountSetId);
    
    // Send confirmation
    ws.send(JSON.stringify({
      type: 'subscription_confirmed',
      data: { accountSetId, message: 'Subscribed to balance updates' }
    }));
    
    // Start balance broadcasting for this account set (unique per WebSocket)
    if (!ws.balanceInterval) {
      console.log('⏰ Starting balance interval for account set:', accountSetId);
      ws.balanceInterval = setInterval(async () => {
        await broadcastBalanceUpdates(accountSetId);
      }, 3000); // Every 3 seconds
      
      // Send initial balance update immediately
      await broadcastBalanceUpdates(accountSetId);
    }
    
  } catch (error) {
    console.error('❌ Error in handleSubscribeSet:', error);
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Failed to subscribe to account set' }
    }));
  }
}

// Handle quote subscription
async function handleSubscribeQuote(ws, msg) {
  console.log('🔍 Quote subscription received:', msg);
  const { futureSymbol, spotSymbol } = msg;
  const accountSetId = msg.accountSetId ?? msg.setId;
  console.log('📊 Quote params:', { accountSetId, futureSymbol, spotSymbol });
  
  if (!accountSetId) {
	 console.log('❌ No accountSetId provided'); 
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'setId is required for quote subscription' }
    }));
    return;
  }
  
  if (ws.quoteInterval) clearInterval(ws.quoteInterval);
  
  try {
    const accountSet = await AccountSet.findByPk(accountSetId, {
      include: [{
        model: Broker,
        as: 'brokers',
        separate: true,
        order: [['position', 'ASC']]
      }]
    });

    if (!accountSet || accountSet.brokers.length < 2) {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Account set not found or missing brokers' }
      }));
      return;
    }

    const futureBroker = accountSet.brokers.find(b => b.position === 1);
    const spotBroker = accountSet.brokers.find(b => b.position === 2);

    if (!futureBroker || !spotBroker) {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Missing required broker positions' }
      }));
      return;
    }

    // Send quotes every 1 second
    const sendQuotes = async () => {
      try {
		 console.log('📡 Sending quotes for:', { futureSymbol, spotSymbol }); 
        const [futureToken, spotToken] = await Promise.all([
          getValidBrokerToken(futureBroker),
          getValidBrokerToken(spotBroker)
        ]);
        
        const [futureQuote, spotQuote] = await Promise.all([
          fetchQuote(futureToken, futureSymbol, futureBroker.terminal, futureBroker.id),
          fetchQuote(spotToken, spotSymbol, spotBroker.terminal, spotBroker.id)
        ]);
        
        const quoteMessage = {
          type: 'quote_update',
          data: { futureSymbol, spotSymbol, futureQuote, spotQuote }
        };
        
        console.log('📡 Broadcasting quote update:', quoteMessage);
        ws.send(JSON.stringify(quoteMessage));
      } catch (err) {
		 console.error('❌ Quote fetch error:', err); 
        
        // Handle token invalid errors by refreshing tokens
        if (err.message === 'TOKEN_INVALID') {
          try {
            console.log('🔄 Token invalid, attempting to refresh tokens and retry...');
            const [newFutureToken, newSpotToken] = await Promise.all([
              getValidBrokerToken(futureBroker, true),
              getValidBrokerToken(spotBroker, true)
            ]);
            
            const [futureQuote, spotQuote] = await Promise.all([
              fetchQuote(newFutureToken, futureSymbol, futureBroker.terminal, futureBroker.id),
              fetchQuote(newSpotToken, spotSymbol, spotBroker.terminal, spotBroker.id)
            ]);
            
            const quoteMessage = {
              type: 'quote_update',
              data: { futureSymbol, spotSymbol, futureQuote, spotQuote }
            };
            
            console.log('✅ Quote fetch successful after token refresh');
            ws.send(JSON.stringify(quoteMessage));
            return;
          } catch (retryErr) {
            console.error('❌ Quote fetch failed even after token refresh:', retryErr);
          }
        }
        
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Failed to fetch quotes' }
        }));
      }
    };
    
    sendQuotes();
    ws.quoteInterval = setInterval(sendQuotes, 1000);
    
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Failed to setup quote subscription' }
    }));
  }
}

// ─── NEW: Handle real‐time premium updates ────────────────────────
async function handleSubscribePremium(ws, msg) {
  const { accountSetId, futureSymbol, spotSymbol } = msg;
  if (!accountSetId) {
    return ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'accountSetId is required for premium subscription' }
    }));
  }
  
  // Join this socket to the account set (so cleanup works)
  subscribeClient(ws, accountSetId);
  
  // Clear any existing premium interval
  if (ws.premiumInterval) clearInterval(ws.premiumInterval);
  
  // Function to fetch & broadcast premium
  const sendPremium = async () => {
    try {
      // Get premium data with both buy and sell premiums
      const resp = await axios.get(
        `${process.env.BACKEND_URL}/api/premium/latest`,
        { params: { accountSetId, futureSymbol, spotSymbol } }
      );
      
      const sellpremium = resp.data.sellpremium;
      // Calculate buy premium (typically sell premium + spread)
      // You may need to adjust this calculation based on your business logic
      const buypremium = resp.data.buypremium || (sellpremium * 1.001); // 0.1% spread as example
      
      // Also get current quotes if available
      let futureQuote = null;
      let spotQuote = null;
      
      try {
        // Try to get current quotes from the premium response or fetch separately
        futureQuote = resp.data.futureQuote;
        spotQuote = resp.data.spotQuote;
      } catch (quoteError) {
        // Quotes are optional, continue without them
      }
  
      // Broadcast the enhanced update with both buy and sell premiums
      ws.send(JSON.stringify({
        type: 'premium_update',
        data: { 
          accountSetId, 
          futureSymbol, 
          spotSymbol, 
          sellpremium,
          buypremium,
          futureQuote,
          spotQuote,
          timestamp: new Date()
        }
      }));
      
      console.log(`✅ Sent premium update for ${accountSetId}: sell=${sellpremium}, buy=${buypremium}`);
      
    } catch (err) {
      console.error('❌ Error fetching premium:', err);
      // On error, record/fall‐back or immediately inform the client
      ws.send(JSON.stringify({
        type: 'error',
        brokerId: accountSetId,               // so client.filter(payload.brokerId===accountSetId) still works
        data: { message: 'Premium service temporarily unavailable' }
      }));
    }
  };
  
  // Fire immediately, then every 5s
  await sendPremium();
  ws.premiumInterval = setInterval(sendPremium, 5000);
}

// ─── NEW: Handle MT4/MT5 positions subscription ────────────────────────
async function handleSubscribePositions(ws, msg) {
  const { accountSetId } = msg;
  if (!accountSetId) {
    return ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'accountSetId is required for positions subscription' }
    }));
  }
  
  console.log('🎯 Starting positions subscription for account set:', accountSetId);
  
  // Get account set with broker configuration
  try {
    const accountSet = await AccountSet.findByPk(accountSetId, {
      include: [{
        model: Broker,
        as: 'brokers',
        separate: true,
        order: [['position', 'ASC']]
      }]
    });

    if (!accountSet || accountSet.brokers.length < 2) {
      return ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Account set not found or missing brokers' }
      }));
    }

    // Find MT4 and MT5 brokers
    const mt5Broker = accountSet.brokers.find(b => b.terminal === 'MT5');
    const mt4Broker = accountSet.brokers.find(b => b.terminal === 'MT4');

    if (!mt5Broker || !mt4Broker) {
      return ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Missing MT4 or MT5 broker in account set' }
      }));
    }

    // Join this socket to the account set
    subscribeClient(ws, accountSetId);
    
    // Clear any existing positions interval
    if (ws.positionsInterval) clearInterval(ws.positionsInterval);
    
    // Function to fetch & broadcast positions
    const sendPositions = async () => {
      try {
        console.log('📡 Fetching positions for account set:', accountSetId);
        
        // Get broker tokens
        const [mt5Token, mt4Token] = await Promise.all([
          getValidBrokerToken(mt5Broker),
          getValidBrokerToken(mt4Broker)
        ]);

        // Get MT5 and MT4 positions using our proxy
        const [mt5Response, mt4Response] = await Promise.allSettled([
          axios.get(`${process.env.BACKEND_URL || 'http://localhost:5000'}/api/mt4mt5/mt5/opened-orders?id=${getMT5ApiId(mt5Broker)}`),
          axios.get(`${process.env.BACKEND_URL || 'http://localhost:5000'}/api/mt4mt5/mt4/opened-orders?id=${getMT4ApiId(mt4Broker)}`)
        ]);

        let mt5Data = [];
        let mt4Data = [];

        if (mt5Response.status === 'fulfilled' && mt5Response.value.data.success) {
          mt5Data = Array.isArray(mt5Response.value.data.data) ? 
            mt5Response.value.data.data : [mt5Response.value.data.data];
        }

        if (mt4Response.status === 'fulfilled' && mt4Response.value.data.success) {
          mt4Data = Array.isArray(mt4Response.value.data.data) ? 
            mt4Response.value.data.data : [mt4Response.value.data.data];
        }

        // Broadcast the positions update
        ws.send(JSON.stringify({
          type: 'positions_update',
          data: { 
            accountSetId, 
            mt5Data: mt5Data.filter(Boolean), 
            mt4Data: mt4Data.filter(Boolean),
            timestamp: new Date()
          }
        }));
        
        console.log(`✅ Sent positions update for ${accountSetId}: MT5=${mt5Data.length}, MT4=${mt4Data.length}`);
        
      } catch (err) {
        console.error('❌ Error fetching positions:', err);
        ws.send(JSON.stringify({
          type: 'error',
          data: { 
            message: 'Failed to fetch positions data',
            accountSetId 
          }
        }));
      }
    };
    
    // Send immediately, then every 2 seconds
    await sendPositions();
    ws.positionsInterval = setInterval(sendPositions, 2000);
    
    console.log('✅ Positions subscription started for account set:', accountSetId);
    
  } catch (error) {
    console.error('❌ Error setting up positions subscription:', error);
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Failed to setup positions subscription' }
    }));
  }
}

// Helper functions for MT4/MT5 API IDs (you'll need to implement proper mapping)
function getMT5ApiId(broker) {
  // For now using hardcoded - implement mapping based on broker configuration
  return 'mf2z4i5f-lzwv-yvj0-ilv2-1ooknlivluc0';
}

function getMT4ApiId(broker) {
  // For now using hardcoded - implement mapping based on broker configuration
  return 'rjooxtv5-ybf5-y7ba-vj1x-l2gpc2s82tgt';
}

async function broadcastBalanceUpdates(accountSetId) {
  console.log('💰 broadcastBalanceUpdates called for:', accountSetId);
  
  try {
    const accountSet = await AccountSet.findByPk(accountSetId, {
      include: [{
        model: Broker,
        as: 'brokers',
        separate: true,
        order: [['position', 'ASC']]
      }]
    });

    if (!accountSet?.brokers) {
      console.warn('⚠ No account set or brokers found for:', accountSetId);
      return;
    }

    console.log(`📊 Found ${accountSet.brokers.length} brokers for account set`);

    // Process brokers with small delays to avoid overwhelming APIs
    for (let i = 0; i < accountSet.brokers.length; i++) {
      const broker = accountSet.brokers[i];
      console.log(`💼 Processing broker ${i + 1}/${accountSet.brokers.length}:`, broker.terminal);
      
      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const data = await fetchBalanceAndPositions(broker);
        console.log('✅ Balance data fetched for broker:', broker.terminal, data.balance);
        
        const balanceMessage = {
          type: 'balance',
          brokerId: broker.id,
          data: {
            balance: data.balance.balance || 0,
            profit: data.balance.profit || 0,
            timestamp: new Date()
          }
        };
        
        console.log('📤 Broadcasting balance update:', balanceMessage);
        broadcastToAccountSet(accountSetId, balanceMessage);
        
      } catch (error) {
        console.error(`❌ Error fetching balance for broker ${broker.terminal}:`, error.message);
        
        const errorMessage = error.message.includes('Circuit breaker') 
          ? 'Service temporarily unavailable'
          : `Failed to fetch data for ${broker.terminal} broker`;
          
        broadcastToAccountSet(accountSetId, {
          type: 'error',
          brokerId: broker.id,
          data: { message: errorMessage }
        });
      }
    }
  } catch (error) {
    console.error('❌ Error in broadcastBalanceUpdates:', error);
  }
}

// ==================== EXTENSIBILITY HOOKS ====================

// Hook for future trade subscription
async function handleSubscribeTrades(ws, msg) {
  // Implementation for trade updates
}

// Hook for future news subscription  
async function handleSubscribeNews(ws, msg) {
  // Implementation for news updates
}

// Hook for custom data broadcasts
function broadcastCustomData(accountSetId, type, data) {
  broadcastToAccountSet(accountSetId, {
    type,
    data,
    timestamp: new Date()
  });
}

// Export for other services to use
app.locals.wss = wss;
app.locals.broadcastToAccountSet = broadcastToAccountSet;
app.locals.broadcastCustomData = broadcastCustomData;

// ==================== SERVER STARTUP ====================

// Connect to database and start server
syncDatabase()
  .then(async () => {
    
    try {
      await persistentDataCollectionService.initialize();
      const activeCollections = persistentDataCollectionService.getCollectionStatus();
    } catch (err) {
      // Data collection failed to initialize
    }
    
    // Start pending order monitor
    try {
      pendingOrderMonitor.start();
      console.log('✅ Pending order monitor started successfully');
    } catch (err) {
      console.error('❌ Failed to start pending order monitor:', err);
    }

    // Start trade status monitor
    try {
      tradeStatusMonitor.start();
      console.log('✅ Trade status monitor started successfully');
    } catch (err) {
      console.error('❌ Failed to start trade status monitor:', err);
    }

    // Start database cleanup service
    try {
      databaseCleanupService.start();
      console.log('✅ Database cleanup service started successfully');
    } catch (err) {
      console.error('❌ Failed to start database cleanup service:', err);
    }
    
    // Start cleanup scheduler
    const cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 24;
    const cleanupMs = cleanupInterval * 60 * 60 * 1000;
    
    cleanupExpiredData();
    setInterval(async () => {
      try {
        await cleanupExpiredData();
        await persistentDataCollectionService.cleanup();
      } catch (error) {
        // Cleanup error
      }
    }, cleanupMs);
    
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  pendingOrderMonitor.stop();
  tradeStatusMonitor.stop();
  await persistentDataCollectionService.shutdown();
  latencyMonitor.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  pendingOrderMonitor.stop();
  tradeStatusMonitor.stop();
  await persistentDataCollectionService.shutdown();
  latencyMonitor.shutdown();
  process.exit(0);
});