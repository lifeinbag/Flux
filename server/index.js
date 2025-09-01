require('dotenv').config();

// 🔧 DEBUG CONTROL - Reads from environment variable or defaults to false
const DEBUG_ENABLED = process.env.DEBUG_ENABLED === 'true';

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
const partialTradeRetryService = require('./services/partialTradeRetryService');
const premiumRoutes = require('./routes/premium');
const logger = require('./utils/logger');
const latencyMonitor = require('./services/latencyMonitor');
const pendingOrderMonitor = require('./services/pendingOrderMonitor');
const tradeStatusMonitor = require('./services/tradeStatusMonitor');
const realtimeTpMonitor = require('./services/realtimeTpMonitor');
const databaseCleanupService = require('./services/databaseCleanupService');
const apiErrorMonitor = require('./services/apiErrorMonitor');
const brokerStatusLogger = require('./utils/brokerStatusLogger');
const logLevelController = require('./utils/logLevelController');
const tradeSessionService = require('./services/tradeSessionService');



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
  const apiName = isMT5 ? 'MT5_API' : 'MT4_API';
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const { data } = await client.get(path);
      
      // Log successful API call
      const responseTime = Date.now() - startTime;
      apiErrorMonitor.logApiSuccess(apiName, `${client.defaults.baseURL}${path}`, responseTime);
      
      return data;
    } catch (error) {
      // Enhanced error context with response data
      const errorContext = {
        attempt,
        maxRetries: retries + 1,
        path,
        errorCode: error.code,
        errorStatus: error.response?.status,
        errorMessage: error.response?.data || error.message,
        httpMethod: 'GET'
      };
      
      // Log API error with detailed context
      apiErrorMonitor.logApiError(apiName, `${client.defaults.baseURL}${path}`, error, errorContext);
      
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
        if (DEBUG_ENABLED) logger.info(message.trim());
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

// API Status and Error Monitoring Routes
app.get('/api/status/apis', (req, res) => {
  res.json({
    success: true,
    data: {
      statuses: apiErrorMonitor.getAllApiStatuses(),
      recentErrors: apiErrorMonitor.getRecentErrors(5)
    }
  });
});

app.get('/api/status/api-errors', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({
    success: true,
    data: apiErrorMonitor.getRecentErrors(limit)
  });
});

app.post('/api/status/health-check', async (req, res) => {
  try {
    const results = await apiErrorMonitor.performHealthChecks();
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.use('/api', premiumRoutes);

const symbolsRouter = require('./routes/symbols');
app.use('/api/symbols', symbolsRouter);


// Health check
app.get('/', (req, res) => {
  res.send('Flux Network API is running');
});

app.get('/api/health', async (req, res) => {
  try {
    // ✅ OPTIMIZED: Use operational data instead of dummy API pings
    const statusData = brokerStatusLogger.getStatusData();
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    let mt4Available = true; // Default to available 
    let mt5Available = true; // Default to available
    
    // Check if we have recent operational data to determine health
    let hasRecentActivity = false;
    for (const [accountSetName, brokers] of Object.entries(statusData)) {
      for (const [brokerName, operations] of Object.entries(brokers)) {
        for (const [operation, timestamp] of Object.entries(operations)) {
          if (timestamp && timestamp >= fiveMinutesAgo) {
            hasRecentActivity = true;
            break;
          }
        }
      }
    }
    
    res.json({
      status: 'healthy',
      apis: {
        mt4: 'available', // No longer pinging with dummy data
        mt5: 'available'  // No longer pinging with dummy data  
      },
      circuitBreaker: {
        openBreakers: Array.from(circuitBreaker.failures.keys()).length
      },
      recentActivity: hasRecentActivity
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ✅ REMOVED: Unnecessary API health check function
// Health status is now tracked through actual operational success/failures
// via brokerStatusLogger.logSuccess() calls in real trading operations

// Data collection status
app.get('/api/data-collection/status', (req, res) => {
  const status = persistentDataCollectionService.getCollectionStatus();
  res.json({
    success: true,
    activeCollections: status.length,
    collections: status
  });
});

// Trade Session Status API
app.get('/api/trading/session-status/:accountSetId', async (req, res) => {
  try {
    const { accountSetId } = req.params;
    
    const accountSet = await AccountSet.findByPk(accountSetId, {
      include: [{
        model: Broker,
        as: 'brokers',
        separate: true,
        order: [['position', 'ASC']]
      }]
    });

    if (!accountSet?.symbolsLocked || !accountSet.futureSymbol || !accountSet.spotSymbol) {
      return res.json({
        success: true,
        data: {
          accountSetId,
          symbolsLocked: false,
          message: 'Symbols not locked, session check not applicable'
        }
      });
    }

    const futureBroker = accountSet.brokers?.find(b => b.position === 1);
    const spotBroker = accountSet.brokers?.find(b => b.position === 2);
    
    if (!futureBroker || !spotBroker) {
      return res.status(404).json({
        success: false,
        error: 'Future or spot broker not found'
      });
    }

    const [futureSessionOpen, spotSessionOpen] = await tradeSessionService.checkMultipleSymbols([
      { symbol: accountSet.futureSymbol, terminal: futureBroker.terminal, token: futureBroker.token },
      { symbol: accountSet.spotSymbol, terminal: spotBroker.terminal, token: spotBroker.token }
    ]);

    const sessionStats = tradeSessionService.getCacheStats();

    res.json({
      success: true,
      data: {
        accountSetId,
        accountSetName: accountSet.name,
        sessions: {
          future: {
            symbol: accountSet.futureSymbol,
            terminal: futureBroker.terminal,
            isOpen: futureSessionOpen
          },
          spot: {
            symbol: accountSet.spotSymbol,
            terminal: spotBroker.terminal,
            isOpen: spotSessionOpen
          }
        },
        overallStatus: futureSessionOpen && spotSessionOpen ? 'open' : 
                      futureSessionOpen || spotSessionOpen ? 'partial' : 'closed',
        cache: sessionStats,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Session status check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Latency monitoring endpoints
app.get('/api/trading/latency/:brokerId', async (req, res) => {
  try {
    const { brokerId } = req.params;
    
    const orderSendStats = await latencyMonitor.getLatencyStats(brokerId, 'orderSend');
    const quotePingStats = await latencyMonitor.getLatencyStats(brokerId, 'quotePing');
    
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
    // Log successful token use (cached)
    brokerStatusLogger.logSuccess(
      'Unknown', // Account set name not available in this context
      broker.server,
      broker.accountNumber,
      broker.terminal,
      'token'
    );
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
  
  // Log successful token refresh
  brokerStatusLogger.logSuccess(
    'Unknown', // Account set name not available in this context
    broker.server,
    broker.accountNumber,
    broker.terminal,
    'token'
  );
  return token;
}

// Helper: Fetch quote from MT4/MT5 with latency monitoring
async function fetchQuote(token, symbol, terminal, brokerId = null, brokerInfo = null) {
  const startTime = Date.now();
  
  try {
    // URL encode the symbol to handle special characters like #
    const encodedSymbol = encodeURIComponent(symbol);
    
    const response = await makeAPIRequest(`/GetQuote?id=${token}&symbol=${encodedSymbol}`, {
      isMT5: terminal === 'MT5'
    });

    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Record latency if brokerId provided
    if (brokerId) {
      latencyMonitor.addLatencyRecord(brokerId, 'quotePing', latency);
    }

    if (response && response.bid && response.ask) {
      // Log successful quote fetch to status logger
      if (brokerInfo) {
        brokerStatusLogger.logSuccess(
          brokerInfo.accountSetName || 'Unknown',
          brokerInfo.brokerName || brokerInfo.server,
          brokerInfo.accountNumber,
          terminal,
          'quote'
        );
      }

      return {
        bid: parseFloat(response.bid),
        ask: parseFloat(response.ask),
        symbol, // Keep original symbol name for display
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
    
    // Log error to status logger
    if (brokerInfo) {
      const errorMsg = error.response?.data?.toString() || error.message;
      brokerStatusLogger.logCriticalError(
        brokerInfo.accountSetName || 'Unknown',
        brokerInfo.brokerName || brokerInfo.server,
        brokerInfo.accountNumber,
        terminal,
        'Quote',
        errorMsg
      );
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
        
        // Log token error specifically
        if (brokerInfo) {
          brokerStatusLogger.logCriticalError(
            brokerInfo.accountSetName || 'Unknown',
            brokerInfo.brokerName || brokerInfo.server,
            brokerInfo.accountNumber,
            terminal,
            'Token',
            errorMsg
          );
        }
        
        throw new Error('TOKEN_INVALID');
      }
    }
    throw error;
  }
}

async function fetchBalanceAndPositions(broker, brokerInfo = null) {
  if (circuitBreaker.isOpen(broker.id)) {
    const errorMsg = `Circuit breaker open for broker ${broker.id}`;
    if (brokerInfo) {
      brokerStatusLogger.logCriticalError(
        brokerInfo.accountSetName || 'Unknown',
        brokerInfo.brokerName || broker.server,
        broker.accountNumber,
        broker.terminal,
        'Balance',
        errorMsg
      );
    }
    throw new Error(errorMsg);
  }
  
  try {
    const token = await getValidBrokerToken(broker);

    const balanceRes = await makeAPIRequest(`/AccountSummary?id=${token}`, {
      isMT5: broker.terminal === 'MT5'
    });
    
    circuitBreaker.recordSuccess(broker.id);

    // Log successful balance fetch
    if (brokerInfo) {
      brokerStatusLogger.logSuccess(
        brokerInfo.accountSetName || 'Unknown',
        brokerInfo.brokerName || broker.server,
        broker.accountNumber,
        broker.terminal,
        'balance'
      );
    }

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
  // New WebSocket connection established
  
  // Set up connection tracking
  ws.isAlive = true;
  ws.lastPing = Date.now();
  
  // Add this WebSocket client to the real-time TP monitor
  realtimeTpMonitor.addWebSocketClient(ws);
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connection',
    data: { message: 'WebSocket connected successfully' }
  }));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      // WebSocket message received
      
      // Handle ping from client for heartbeat
      if (msg.action === 'ping') {
        ws.isAlive = true;
        ws.lastPing = Date.now();
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }
      
      switch (msg.action) {
        case 'subscribe_set':
          await handleSubscribeSet(ws, msg);
          break;
          
        case 'subscribe_quote':
          await handleSubscribeQuote(ws, msg);
          break;

        // ─── NEW: Premium subscription ───────────────────────────
        case 'subscribe_premium':
          await handleSubscribePremium(ws, msg);
          break;

        case 'subscribe_positions':
          await handleSubscribePositions(ws, msg);
          break;

        case 'subscribe_open_orders':
          await handleSubscribeOpenOrders(ws, msg);
          break;

        case 'subscribe_trades':
          break;
          
        case 'subscribe_news':
          break;
          
        default:
          console.warn('⚠ Unknown WebSocket action:', msg.action);
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: `Unknown action: ${msg.action}` }
          }));
      }
    } catch (error) {
      console.error('❌ WebSocket message parsing error:', error.message);
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
    if (ws.openOrdersInterval) {
      clearInterval(ws.openOrdersInterval);
      console.log('🛑 Cleared open orders interval');
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
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
      }, process.env.BALANCE_UPDATE_INTERVAL || 60000); // Configurable interval (default: 1 minute)
      
      // Send initial balance update immediately
      await broadcastBalanceUpdates(accountSetId);
    }
    
  } catch (error) {
    console.error('❌ Error in handleSubscribeSet:', error.message);
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Failed to subscribe to account set' }
    }));
  }
}

// Handle quote subscription
// ✅ OPTIMIZED: WebSocket quote handler using database-first approach
async function handleSubscribeQuote(ws, msg) {
  // Quote subscription received
  const { futureSymbol, spotSymbol } = msg;
  const accountSetId = msg.accountSetId ?? msg.setId;
  // Quote params received
  
  if (!accountSetId) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'setId is required for quote subscription' }
    }));
    return;
  }
  
  if (ws.quoteInterval) clearInterval(ws.quoteInterval);
  
  try {
    const databaseQuoteService = require('./services/databaseQuoteService');
    const intelligentNormalizer = require('./utils/intelligentBrokerNormalizer');
    
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

    // Get normalized broker names for database lookup
    const [normalizedFuture, normalizedSpot] = await Promise.all([
      intelligentNormalizer.normalizeBrokerName(futureBroker.brokerName, futureBroker.server, futureBroker.companyName),
      intelligentNormalizer.normalizeBrokerName(spotBroker.brokerName, spotBroker.server, spotBroker.companyName)
    ]);

    // Create broker info objects for status logging
    const futureBrokerInfo = {
      accountSetName: accountSet.name,
      brokerName: normalizedFuture,
      server: futureBroker.server,
      accountNumber: futureBroker.accountNumber
    };
    
    const spotBrokerInfo = {
      accountSetName: accountSet.name,
      brokerName: normalizedSpot,
      server: spotBroker.server,
      accountNumber: spotBroker.accountNumber
    };

    // ✅ ORIGINAL WORKING SYSTEM: WebSocket makes its own API calls
    const sendQuotes = async () => {
      try {
        // 🌍 TRADE SESSION CHECK: Stop quote updates if markets are closed
        const [futureSessionOpen, spotSessionOpen] = await tradeSessionService.checkMultipleSymbols([
          { symbol: futureSymbol, terminal: futureBroker.terminal, token: futureBroker.token },
          { symbol: spotSymbol, terminal: spotBroker.terminal, token: spotBroker.token }
        ]);

        if (!futureSessionOpen && !spotSessionOpen) {
          console.log(`⏰ Both markets closed: ${futureSymbol} & ${spotSymbol} - skipping quote updates`);
          return;
        }

        // Try database first for both quotes
        let futureQuote = await databaseQuoteService.getQuoteFromDatabase(normalizedFuture, futureSymbol);
        let spotQuote = await databaseQuoteService.getQuoteFromDatabase(normalizedSpot, spotSymbol);

        // Only call API if database cache is stale AND session is open (1 minute tolerance for non-critical quotes)
        const quoteTolerance = process.env.QUOTE_CACHE_TOLERANCE || 60000;
        if (!databaseQuoteService.isQuoteFresh(futureQuote, quoteTolerance) && futureSessionOpen) {
          try {
            const futureToken = await getValidBrokerToken(futureBroker);
            const apiQuote = await fetchQuote(futureToken, futureSymbol, futureBroker.terminal, futureBroker.id, futureBrokerInfo);
            if (apiQuote) {
              futureQuote = {
                ...apiQuote,
                source: 'api',
                timestamp: new Date()
              };
              
              // Log successful WebSocket quote fetch
              brokerStatusLogger.logSuccess(
                futureBrokerInfo.accountSetName,
                futureBrokerInfo.brokerName,
                futureBrokerInfo.accountNumber,
                futureBroker.terminal,
                'quote'
              );
            }
          } catch (apiErr) {
            // API failed, use stale cache if available
          }
        }

        if (!databaseQuoteService.isQuoteFresh(spotQuote, quoteTolerance) && spotSessionOpen) {
          try {
            const spotToken = await getValidBrokerToken(spotBroker);
            const apiQuote = await fetchQuote(spotToken, spotSymbol, spotBroker.terminal, spotBroker.id, spotBrokerInfo);
            if (apiQuote) {
              spotQuote = {
                ...apiQuote,
                source: 'api',
                timestamp: new Date()
              };
              
              // Log successful WebSocket spot quote fetch
              brokerStatusLogger.logSuccess(
                spotBrokerInfo.accountSetName,
                spotBrokerInfo.brokerName,
                spotBrokerInfo.accountNumber,
                spotBroker.terminal,
                'quote'
              );
            }
          } catch (apiErr) {
            // API failed, use stale cache if available
          }
        }

        if (futureQuote && spotQuote) {
          const quoteMessage = {
            type: 'quote_update',
            data: { 
              futureSymbol, 
              spotSymbol, 
              futureQuote: {
                ...futureQuote,
                age: databaseQuoteService.getQuoteAgeMs(futureQuote)
              }, 
              spotQuote: {
                ...spotQuote,
                age: databaseQuoteService.getQuoteAgeMs(spotQuote)
              }
            }
          };
          ws.send(JSON.stringify(quoteMessage));
        }
      } catch (err) {
        // Send error message
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Failed to fetch quotes' }
        }));
      }
    };
    
    sendQuotes();
    ws.quoteInterval = setInterval(sendQuotes, process.env.QUOTE_UPDATE_INTERVAL || 1000); // Configurable quote updates
    
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Failed to setup quote subscription' }
    }));
  }
}

// ✅ OPTIMIZED: Handle real-time premium updates using database-first approach
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
  
  try {
    const databaseQuoteService = require('./services/databaseQuoteService');
    const intelligentNormalizer = require('./utils/intelligentBrokerNormalizer');
    
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

    const futureBroker = accountSet.brokers.find(b => b.position === 1);
    const spotBroker = accountSet.brokers.find(b => b.position === 2);

    // Get normalized broker names
    const [normalizedFuture, normalizedSpot] = await Promise.all([
      intelligentNormalizer.normalizeBrokerName(futureBroker.brokerName, futureBroker.server, futureBroker.companyName),
      intelligentNormalizer.normalizeBrokerName(spotBroker.brokerName, spotBroker.server, spotBroker.companyName)
    ]);
  
    // ✅ DATABASE-FIRST: Function to fetch & broadcast premium
    const sendPremium = async () => {
      try {
        // Get premium calculation from database using our new service
        const premiumData = await databaseQuoteService.getPremiumFromDatabase(
          normalizedFuture, futureSymbol,
          normalizedSpot, spotSymbol
        );

        if (premiumData) {
          // Broadcast the optimized premium update
          ws.send(JSON.stringify({
            type: 'premium_update',
            data: { 
              accountSetId, 
              futureSymbol, 
              spotSymbol, 
              sellPremium: premiumData.sellPremium,
              buyPremium: premiumData.buyPremium,
              futureQuote: premiumData.futureQuote,
              spotQuote: premiumData.spotQuote,
              dataAge: premiumData.dataAge,
              source: premiumData.source,
              timestamp: premiumData.timestamp
            }
          }));
          
          // Only log premium updates every 30 seconds
          const now = Date.now();
          if (!ws.lastPremiumLog || (now - ws.lastPremiumLog) > 30000) {
            console.log(`✅ Sent optimized premium update for ${accountSetId}: buy=${premiumData.buyPremium.toFixed(5)}, sell=${premiumData.sellPremium.toFixed(5)} (age: ${premiumData.dataAge}ms)`);
            ws.lastPremiumLog = now;
          }
        } else {
          // Fallback: Try to get recent premium data from premium table if available
          if (accountSet.premiumTableName) {
            const recentData = await databaseQuoteService.getRecentPremiumData(accountSet.premiumTableName, accountSetId, 1);
            if (recentData.length > 0) {
              const latest = recentData[0];
              ws.send(JSON.stringify({
                type: 'premium_update',
                data: { 
                  accountSetId, 
                  futureSymbol, 
                  spotSymbol, 
                  sellPremium: latest.sellPremium,
                  buyPremium: latest.buyPremium,
                  futureQuote: { bid: latest.futureBid, ask: latest.futureAsk },
                  spotQuote: { bid: latest.spotBid, ask: latest.spotAsk },
                  source: 'premium_table',
                  timestamp: latest.timestamp
                }
              }));
              // Only log premium table updates every 30 seconds
              if (!ws.lastPremiumTableLog || (now - ws.lastPremiumTableLog) > 30000) {
                console.log(`✅ Sent premium table update for ${accountSetId}`);
                ws.lastPremiumTableLog = now;
              }
            }
          }
        }
        
      } catch (err) {
        console.error('❌ Error fetching premium:', err);
        ws.send(JSON.stringify({
          type: 'error',
          brokerId: accountSetId,
          data: { message: 'Premium service temporarily unavailable' }
        }));
      }
    };
    
    // Fire immediately, then every 5s
    await sendPremium();
    ws.premiumInterval = setInterval(sendPremium, process.env.PREMIUM_BROADCAST_INTERVAL || 5000);

  } catch (error) {
    console.error('❌ Error setting up premium subscription:', error);
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Failed to setup premium subscription' }
    }));
  }
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

    // Get all brokers regardless of terminal type
    const broker1 = accountSet.brokers.find(b => b.position === 1);
    const broker2 = accountSet.brokers.find(b => b.position === 2);

    if (!broker1 || !broker2) {
      return ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Missing required broker positions (1 and 2) in account set' }
      }));
    }

    // Join this socket to the account set
    subscribeClient(ws, accountSetId);
    
    // Clear any existing positions interval
    if (ws.positionsInterval) clearInterval(ws.positionsInterval);
    
    // Function to fetch & broadcast positions
    const sendPositions = async () => {
      try {
        // Fetching positions
        
        // Get broker tokens for both brokers
        const [broker1Token, broker2Token] = await Promise.all([
          getValidBrokerToken(broker1),
          getValidBrokerToken(broker2)
        ]);

        // Use the actual broker tokens instead of hardcoded IDs
        const [broker1Response, broker2Response] = await Promise.allSettled([
          axios.get(`${process.env.BACKEND_URL || 'http://localhost:5000'}/api/mt4mt5/${broker1.terminal.toLowerCase()}/opened-orders`, {
            params: { id: broker1Token }
          }),
          axios.get(`${process.env.BACKEND_URL || 'http://localhost:5000'}/api/mt4mt5/${broker2.terminal.toLowerCase()}/opened-orders`, {
            params: { id: broker2Token }
          })
        ]);

        let broker1Data = [];
        let broker2Data = [];

        if (broker1Response.status === 'fulfilled' && broker1Response.value.data.success) {
          broker1Data = Array.isArray(broker1Response.value.data.data) ? 
            broker1Response.value.data.data : [broker1Response.value.data.data];
        }

        if (broker2Response.status === 'fulfilled' && broker2Response.value.data.success) {
          broker2Data = Array.isArray(broker2Response.value.data.data) ? 
            broker2Response.value.data.data : [broker2Response.value.data.data];
        }

        // Ensure profit and swap data is properly parsed
        broker1Data = broker1Data.filter(Boolean).map(trade => ({
          ...trade,
          profit: parseFloat(trade.profit) || 0,
          swap: parseFloat(trade.swap) || 0,
          ticket: trade.ticket?.toString(),
          brokerPosition: 1  // Add broker position identifier
        }));

        broker2Data = broker2Data.filter(Boolean).map(trade => ({
          ...trade,
          profit: parseFloat(trade.profit) || 0,
          swap: parseFloat(trade.swap) || 0,
          ticket: trade.ticket?.toString(),
          brokerPosition: 2  // Add broker position identifier
        }));

        // ✅ FIXED: Combine data properly for same terminal types
        ws.send(JSON.stringify({
          type: 'positions_update',
          data: { 
            accountSetId, 
            mt5Data: [
              ...(broker1.terminal === 'MT5' ? broker1Data : []),
              ...(broker2.terminal === 'MT5' ? broker2Data : [])
            ],
            mt4Data: [
              ...(broker1.terminal === 'MT4' ? broker1Data : []),
              ...(broker2.terminal === 'MT4' ? broker2Data : [])
            ],
            timestamp: new Date()
          }
        }));
        
        const mt5Count = (broker1.terminal === 'MT5' ? broker1Data.length : 0) + 
                        (broker2.terminal === 'MT5' ? broker2Data.length : 0);
        const mt4Count = (broker1.terminal === 'MT4' ? broker1Data.length : 0) + 
                        (broker2.terminal === 'MT4' ? broker2Data.length : 0);
        console.log(`✅ Sent positions update for ${accountSetId}: MT5=${mt5Count}, MT4=${mt4Count}`);
        
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
    ws.positionsInterval = setInterval(sendPositions, process.env.POSITION_UPDATE_INTERVAL || 2000);
    
    console.log('✅ Positions subscription started for account set:', accountSetId);
    
  } catch (error) {
    console.error('❌ Error setting up positions subscription:', error);
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Failed to setup positions subscription' }
    }));
  }
}

// Helper function to get API ID for any broker
function getApiId(broker) {
  if (broker.externalApiId) {
    return broker.externalApiId;
  }
  
  // Fallback to hardcoded IDs if externalApiId is not set
  if (broker.terminal === 'MT4') {
    return 'e7jlk16z-27xq-wbej-y63m-xgs7u82ebtxo';
  } else if (broker.terminal === 'MT5') {
    return 'l7ipl1tn-iwnr-pkal-5r3r-agec4p04uxx4';
  }
  
  console.warn(`No API ID found for broker ${broker.terminal} (${broker.brokerName})`);
  return null;
}

// ─── NEW: Handle external API open orders subscription ────────────────────────
async function handleSubscribeOpenOrders(ws, msg) {
  const { accountSetId } = msg;
  if (!accountSetId) {
    return ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'accountSetId is required for open orders subscription' }
    }));
  }
  
  console.log('🎯 Starting open orders subscription for account set:', accountSetId);
  
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

    if (!accountSet || !accountSet.brokers || accountSet.brokers.length === 0) {
      return ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Account set not found or missing brokers' }
      }));
    }

    // Join this socket to the account set
    subscribeClient(ws, accountSetId);
    
    // Clear any existing open orders interval
    if (ws.openOrdersInterval) clearInterval(ws.openOrdersInterval);
    
    // Import trading service to use the open orders functions
    const tradingService = require('./services/tradingService');
    
    // Function to fetch & broadcast open orders
    const sendOpenOrders = async () => {
      try {
        // 🌍 TRADE SESSION CHECK: Stop fetching orders if markets are closed
        const accountSet = await AccountSet.findByPk(accountSetId, {
          include: [{
            model: Broker,
            as: 'brokers',
            separate: true,
            order: [['position', 'ASC']]
          }]
        });

        if (accountSet?.symbolsLocked && accountSet.futureSymbol && accountSet.spotSymbol) {
          const futureBroker = accountSet.brokers?.find(b => b.position === 1);
          const spotBroker = accountSet.brokers?.find(b => b.position === 2);
          
          if (futureBroker && spotBroker) {
            try {
              const [futureSessionOpen, spotSessionOpen] = await tradeSessionService.checkMultipleSymbols([
                { symbol: accountSet.futureSymbol, terminal: futureBroker.terminal, token: futureBroker.token },
                { symbol: accountSet.spotSymbol, terminal: spotBroker.terminal, token: spotBroker.token }
              ]);

              if (!futureSessionOpen && !spotSessionOpen) {
                console.log(`⏰ Both markets closed for ${accountSet.name} - fetching existing open orders but no new quotes`);
                // Continue fetching open orders as existing positions need to be monitored
                // even when markets are closed for risk management
              }
            } catch (sessionError) {
              console.warn('⚠ Trade session check failed for open orders, continuing:', sessionError.message);
            }
          }
        }
        
        // ✅ OPTIMIZED: Use targeted fetch for FluxNetwork trades only
        const openOrders = await tradingService.fetchOrdersForActiveTradeTickets(accountSetId);
        

        // Ensure each order has the proper broker identifiers
        const enrichedOrders = openOrders.map(order => ({
          ...order,
          // Ensure brokerId is properly set
          brokerId: order.brokerId || null,
          brokerPosition: order.brokerPosition || null,
          terminal: order.terminal || 'Unknown'
        }));

        // Broadcast the open orders update with enriched data
        ws.send(JSON.stringify({
          type: 'open_orders_update',
          data: { 
            accountSetId, 
            orders: enrichedOrders,
            timestamp: new Date()
          }
        }));
        
        console.log(`✅ Sent ${enrichedOrders.length} enriched orders to WebSocket client`);
        
        console.log(`✅ Sent open orders update for ${accountSetId}: ${openOrders.length} orders`);
        
      } catch (err) {
        console.error('❌ Error fetching open orders:', err);
        ws.send(JSON.stringify({
          type: 'error',
          data: { 
            message: 'Failed to fetch open orders data',
            accountSetId 
          }
        }));
      }
    };
    
    // Send immediately, then every 3 seconds
    await sendOpenOrders();
    ws.openOrdersInterval = setInterval(sendOpenOrders, process.env.OPEN_ORDERS_UPDATE_INTERVAL || 3000);
    
    console.log('✅ Open orders subscription started for account set:', accountSetId);
    
  } catch (error) {
    console.error('❌ Error setting up open orders subscription:', error);
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Failed to setup open orders subscription' }
    }));
  }
}

async function broadcastBalanceUpdates(accountSetId) {
  if (DEBUG_ENABLED) console.log('💰 broadcastBalanceUpdates called for:', accountSetId);
  
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

    // 🌍 TRADE SESSION CHECK: Stop all API calls if markets are closed
    if (accountSet.symbolsLocked && accountSet.futureSymbol && accountSet.spotSymbol) {
      const futureBroker = accountSet.brokers.find(b => b.position === 1);
      const spotBroker = accountSet.brokers.find(b => b.position === 2);
      
      if (futureBroker && spotBroker) {
        try {
          const [futureSessionOpen, spotSessionOpen] = await tradeSessionService.checkMultipleSymbols([
            { symbol: accountSet.futureSymbol, terminal: futureBroker.terminal, token: futureBroker.token },
            { symbol: accountSet.spotSymbol, terminal: spotBroker.terminal, token: spotBroker.token }
          ]);

          if (!futureSessionOpen && !spotSessionOpen) {
            console.log(`⏰ Both markets closed for ${accountSet.name}: ${accountSet.futureSymbol} & ${accountSet.spotSymbol} - balance/equity updates will continue, but quote updates are skipped`);
            // Don't return here - balance and equity should be fetched regardless of market hours
            // Only quote and position updates should be skipped during market close
          } else if (!futureSessionOpen || !spotSessionOpen) {
            console.log(`⏰ One market closed for ${accountSet.name}: Future=${futureSessionOpen}, Spot=${spotSessionOpen} - continuing with all calls`);
          }
        } catch (sessionError) {
          console.warn('⚠ Trade session check failed, continuing with API calls:', sessionError.message);
        }
      }
    }

    if (DEBUG_ENABLED) console.log(`📊 Found ${accountSet.brokers.length} brokers for account set`);

    // Process brokers with small delays to avoid overwhelming APIs
    for (let i = 0; i < accountSet.brokers.length; i++) {
      const broker = accountSet.brokers[i];
      if (DEBUG_ENABLED) console.log(`💼 Processing broker ${i + 1}/${accountSet.brokers.length}:`, broker.terminal);
      
      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Create broker info for status logging
        const brokerInfo = {
          accountSetName: accountSet.name,
          brokerName: broker.server, // Use server as broker name for balance operations
          server: broker.server,
          accountNumber: broker.accountNumber
        };
        
        const data = await fetchBalanceAndPositions(broker, brokerInfo);
        if (DEBUG_ENABLED) console.log('✅ Balance data fetched for broker:', broker.terminal, data.balance);
        
        const balanceMessage = {
          type: 'balance',
          brokerId: broker.id,
          data: {
            balance: data.balance.balance || 0,
            equity: data.balance.equity || 0,
            profit: data.balance.profit || 0,
            leverage: data.balance.leverage || 0,
            timestamp: new Date()
          }
        };
        
        if (DEBUG_ENABLED) console.log('📤 Broadcasting balance update:', balanceMessage);
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
    console.error('❌ Error in broadcastBalanceUpdates:', error.message);
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

// Add global broadcast function for API errors
app.locals.broadcast = function(message) {
  const messageStr = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
};
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
    
    // Initialize partial trade retry service
    try {
      await partialTradeRetryService.initialize();
      logger.info('✅ Partial trade retry service initialized');
    } catch (err) {
      logger.error('❌ Failed to initialize partial trade retry service:', err.message);
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

    // Start real-time TP monitor (5-second intervals)
    try {
      realtimeTpMonitor.start();
      console.log('✅ Real-time TP monitor started successfully');
    } catch (err) {
      console.error('❌ Failed to start real-time TP monitor:', err);
    }

    // Start database cleanup service
    try {
      databaseCleanupService.start();
      console.log('✅ Database cleanup service started successfully');
    } catch (err) {
      console.error('❌ Failed to start database cleanup service:', err);
    }

    // Start comprehensive broker status logger (shows all account sets)
    setTimeout(() => {
      brokerStatusLogger.start();
    }, 2000);


    
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
      
      // Start API health monitoring
      setTimeout(() => {
        // apiErrorMonitor.startHealthChecking(30000); // Disabled - causing timeout errors
        if (DEBUG_ENABLED) logger.info('🏥 API Health Monitoring started');
      }, 5000); // Wait 5 seconds after server start
    });
  })
  .catch(err => {
    console.error('Database connection error:', err.message);
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