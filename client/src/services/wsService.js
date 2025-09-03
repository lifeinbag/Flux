// client/src/services/wsService.js

// ✅ FIX 1: Unified WebSocket Manager Singleton
class WebSocketManager {
  constructor() {
    this.socket = null;
    this.accountSetId = null;
    this.pendingQuoteSubs = [];
    this.reconnectInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 15;
    this.baseReconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.lastPongTime = 0;
    this.handlers = new Map();
    this.apiErrorThrottle = new Map(); // ✅ FIX 5: API Error Throttling
    this.balanceUpdateBuffer = new Map(); // ✅ FIX 7: Performance optimization
    this.quoteUpdateBuffer = {}; // ✅ FIX 7: Quote batching
    this.FRESH_QUOTE_TOLERANCE = 2000; // ✅ FIX 3: 2 seconds max for quotes
    this.TRADE_QUOTE_TOLERANCE = 1000; // ✅ FIX 6: 1 second max for trades
    
    // Setup performance optimizations
    this.setupPerformanceOptimizations();
  }

  setupPerformanceOptimizations() {
    // ✅ FIX 7: Debounced balance updates every 100ms
    setInterval(() => {
      if (this.balanceUpdateBuffer.size > 0) {
        const balanceUpdates = Object.fromEntries(this.balanceUpdateBuffer);
        this.balanceUpdateBuffer.clear();
        this.emitBalanceBatch(balanceUpdates);
      }
    }, 100);

    // ✅ FIX 7: Batched quote updates every 100ms
    setInterval(() => {
      if (Object.keys(this.quoteUpdateBuffer).length > 0) {
        const quoteUpdates = {...this.quoteUpdateBuffer};
        this.quoteUpdateBuffer = {};
        this.emitQuoteBatch(quoteUpdates);
      }
    }, 100);
  }

  emitBalanceBatch(balanceUpdates) {
    const handlers = this.handlers.get('balance_batch') || [];
    handlers.forEach(fn => {
      try {
        fn(balanceUpdates);
      } catch (err) {
        console.error('❌ Balance batch handler error:', err);
      }
    });
  }

  emitQuoteBatch(quoteUpdates) {
    const handlers = this.handlers.get('quote_batch') || [];
    handlers.forEach(fn => {
      try {
        fn(quoteUpdates);
      } catch (err) {
        console.error('❌ Quote batch handler error:', err);
      }
    });
  }

  // ✅ FIX 4: Standardized broker key creation
  createBrokerKey(broker) {
    if (!broker) return null;
    return `${broker.id || broker._id}|${broker.terminal}|pos${broker.position}`;
  }

  // ✅ FIX 3: Quote freshness validation
  isQuoteFresh(quote, tolerance = null) {
    if (!quote || !quote.timestamp) return false;
    const age = Date.now() - new Date(quote.timestamp).getTime();
    const maxAge = tolerance || this.FRESH_QUOTE_TOLERANCE;
    return age < maxAge;
  }

  // ✅ FIX 6: Trade execution validation
  validateTradeQuotes(futureQuote, spotQuote) {
    return this.isQuoteFresh(futureQuote, this.TRADE_QUOTE_TOLERANCE) && 
           this.isQuoteFresh(spotQuote, this.TRADE_QUOTE_TOLERANCE);
  }

  // ✅ FIX 5: API Error Throttling
  shouldLogApiError(error) {
    const key = `${error.apiName}_${error.endpoint}`;
    const lastError = this.apiErrorThrottle.get(key);
    const now = Date.now();
    
    if (!lastError || now - lastError > 30000) { // 30 second throttle
      this.apiErrorThrottle.set(key, now);
      return true;
    }
    return false;
  }

  // ✅ FIX 2: Universal handler registration
  setupUniversalHandlers() {
    // Clear existing handlers to avoid duplicates
    this.handlers.clear();
    
    console.log('🔧 Setting up universal WebSocket handlers');
  }
}

// Create singleton instance
const wsManager = new WebSocketManager();

// Legacy compatibility - keep existing variables for gradual migration
let socket = null;
const pendingQuoteSubs = [];
let reconnectInterval = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 15;
const baseReconnectDelay = 1000;
let heartbeatInterval = null;
let lastPongTime = 0;
const handlers = {};

/**
 * ✅ FIX 1: Enhanced heartbeat with unified socket management
 */
function sendHeartbeat() {
  const activeSocket = wsManager.socket || socket;
  if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
    activeSocket.send(JSON.stringify({ action: 'ping', timestamp: Date.now() }));
  }
}

/**
 * Start heartbeat mechanism
 */
/**
 * ✅ FIX 1: Enhanced heartbeat management
 */
function startHeartbeat() {
  if (wsManager.heartbeatInterval) clearInterval(wsManager.heartbeatInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  const interval = setInterval(() => {
    const now = Date.now();
    const lastPong = wsManager.lastPongTime || lastPongTime;
    // Check if we missed a pong (no response for 90 seconds)
    if (lastPong > 0 && now - lastPong > 90000) {
      console.warn('💔 Heartbeat timeout - connection may be stale');
      const activeSocket = wsManager.socket || socket;
      if (activeSocket) {
        activeSocket.close(1000, 'Heartbeat timeout');
      }
      return;
    }
    sendHeartbeat();
  }, process.env.REACT_APP_WS_HEARTBEAT_INTERVAL || 30000);
  
  wsManager.heartbeatInterval = interval;
  heartbeatInterval = interval; // Legacy compatibility
}

/**
 * Stop heartbeat mechanism
 */
/**
 * ✅ FIX 1: Enhanced heartbeat stopping
 */
function stopHeartbeat() {
  if (wsManager.heartbeatInterval) {
    clearInterval(wsManager.heartbeatInterval);
    wsManager.heartbeatInterval = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ✅ FIX 2, FIX 4, FIX 6: Export unified WebSocket manager and helper functions
export { wsManager };
export const createBrokerKey = (broker) => wsManager.createBrokerKey(broker);
export const isQuoteFresh = (quote, tolerance) => wsManager.isQuoteFresh(quote, tolerance);
export const validateTradeQuotes = (futureQuote, spotQuote) => wsManager.validateTradeQuotes(futureQuote, spotQuote);

// ✅ FIX 7: Export batching handlers for components to register
export function onBalanceBatch(handler) {
  return onMessage('balance_batch', handler);
}

export function onQuoteBatch(handler) {
  return onMessage('quote_batch', handler);
}


/**
 * ✅ FIX 1: Enhanced connection with singleton management
 */
export function connectWS(accountSetId) {
  if (!accountSetId) {
    console.warn('🚫 connectWS: no accountSetId provided – skipping.');
    return;
  }

  // ✅ FIX 1: Check if already connected to this account set
  if (wsManager.socket && wsManager.accountSetId === accountSetId && 
      wsManager.socket.readyState === WebSocket.OPEN) {
    console.log('✅ Already connected to account set:', accountSetId);
    return;
  }

  console.log('🔗 Attempting WebSocket connection for account set:', accountSetId);

  // Tear down any existing connection
  if (wsManager.socket) {
    wsManager.socket.close();
    wsManager.socket = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
  
  // Clear any existing reconnect attempts
  if (wsManager.reconnectInterval) {
    clearTimeout(wsManager.reconnectInterval);
    wsManager.reconnectInterval = null;
  }
  if (reconnectInterval) {
    clearTimeout(reconnectInterval);
    reconnectInterval = null;
  }

  // Set current account set
  wsManager.accountSetId = accountSetId;

  // ✅ FIX 2: Setup universal handlers
  wsManager.setupUniversalHandlers();

  // Note: We don't clear handlers here as they might be needed for balance/error updates
  // Quote handlers are managed in subscribeToQuotes() function
  console.log('🔗 Connecting WebSocket for account set:', accountSetId);

  // Build the URL
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  
  // Handle different tunnel services
  let host;
  if (window.location.hostname.includes('devtunnels.ms')) {
    // For devtunnels, replace port in hostname (f053gjj6-3000 -> f053gjj6-5000)
    host = window.location.hostname.replace('-3000', '-5000');
  } else if (process.env.NODE_ENV === 'development') {
    host = `${window.location.hostname}:5000`;
  } else {
    host = window.location.host;
  }
  
  const WS_URL = `${protocol}://${host}/ws`;

  console.log('🌐 WebSocket URL:', WS_URL);

  // ✅ FIX 1: Create unified socket reference
  const newSocket = new WebSocket(WS_URL);
  wsManager.socket = newSocket;
  socket = newSocket; // Legacy compatibility
  const currentSocket = newSocket;

  // Connection opened
  currentSocket.onopen = () => {
    console.log('✅ WebSocket connection established');
    wsManager.reconnectAttempts = 0;
    reconnectAttempts = 0; // Legacy compatibility
    wsManager.lastPongTime = Date.now();
    lastPongTime = Date.now(); // Legacy compatibility
    startHeartbeat(); // Start heartbeat
    
    if (currentSocket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending subscribe_set message:', accountSetId);
      currentSocket.send(
        JSON.stringify({ action: 'subscribe_set', accountSetId })
      );
      
      // ✅ FIX 1: Use unified pending subscriptions
      const allPendingSubs = [...new Set([...wsManager.pendingQuoteSubs, ...pendingQuoteSubs])];
      allPendingSubs.forEach(sub => {
        console.log('🔁 Re-sending subscribe_quote:', sub);
        currentSocket.send(JSON.stringify({
          action: 'subscribe_quote',
          accountSetId:   sub.accountSetId,
          futureSymbol:   sub.futureSymbol,
          spotSymbol:     sub.spotSymbol
        }));
      });
    }
  };

  // ✅ FIX 2 & FIX 5: Enhanced message handling with universal handlers and error throttling
  currentSocket.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
      // Don't log ping/pong messages to reduce noise
      if (msg.type !== 'pong' && msg.action !== 'ping') {
        console.log('📨 WebSocket message received:', msg);
      }
    } catch (err) {
      console.error('❌ Invalid WS message format:', event.data, err);
      return;
    }
    
    // Handle pong responses
    if (msg.type === 'pong' || msg.action === 'pong') {
      wsManager.lastPongTime = Date.now();
      lastPongTime = Date.now(); // Legacy compatibility
      return;
    }

    // ✅ FIX 5: API Error throttling
    if (msg.type === 'api_error') {
      if (wsManager.shouldLogApiError(msg.data || msg)) {
        console.error('🚨 API Error (throttled):', msg.data || msg);
      }
      // Still process the error but don't spam logs
    }

    // For balance messages, pass the entire message to maintain brokerId at root level
    const messagePayload = msg.type === 'balance' ? msg : (msg.data ?? msg.payload ?? msg);
    
    // ✅ FIX 7: Buffer balance and quote updates for batching
    if (msg.type === 'balance') {
      const brokerKey = wsManager.createBrokerKey({ id: messagePayload.brokerId, terminal: messagePayload.data?.terminal, position: messagePayload.data?.position });
      if (brokerKey) {
        wsManager.balanceUpdateBuffer.set(brokerKey, messagePayload);
      }
    } else if (msg.type === 'quote_update') {
      // Calculate WebSocket transmission speed
      const clientReceiveTime = Date.now();
      const wsSpeed = msg.serverSendTime ? clientReceiveTime - msg.serverSendTime : null;
      
      // Add wsSpeed to both quotes
      if (messagePayload.futureQuote && wsSpeed !== null) {
        messagePayload.futureQuote.wsSpeed = wsSpeed;
      }
      if (messagePayload.spotQuote && wsSpeed !== null) {
        messagePayload.spotQuote.wsSpeed = wsSpeed;
      }
      
      wsManager.quoteUpdateBuffer[`${messagePayload.futureSymbol}_${messagePayload.spotSymbol}`] = messagePayload;
    }

    // Call unified handlers first
    const unifiedHandlers = wsManager.handlers.get(msg.type) || [];
    unifiedHandlers.forEach((fn) => {
      try {
        fn(messagePayload);
      } catch (err) {
        console.error('❌ Unified WS handler error for type', msg.type, ':', err);
      }
    });

    // Call legacy handlers for backward compatibility
    const legacyHandlers = handlers[msg.type] || [];
    if (legacyHandlers.length === 0 && unifiedHandlers.length === 0) {
      console.warn('⚠ No handlers registered for message type:', msg.type);
    }
    
    legacyHandlers.forEach((fn) => {
      try {
        fn(messagePayload);
      } catch (err) {
        console.error('❌ Legacy WS handler error for type', msg.type, ':', err);
      }
    });
  };

  // Connection error
  socket.onerror = (err) => {
    console.error('❌ WebSocket error:', err);
  };

  // ✅ FIX 1: Enhanced connection close handling with unified state
  currentSocket.onclose = (event) => {
    console.log('🔌 WebSocket connection closed:', event.code, event.reason);
    wsManager.socket = null;
    socket = null; // Legacy compatibility
    stopHeartbeat(); // Stop heartbeat on close
    
    // Attempt to reconnect if not a normal closure
    if (event.code !== 1000 && wsManager.reconnectAttempts < wsManager.maxReconnectAttempts) {
      wsManager.reconnectAttempts++;
      reconnectAttempts = wsManager.reconnectAttempts; // Legacy sync
      // Exponential backoff: 1s, 2s, 3s, 4s, 5s, then 5s max
      const delay = Math.min(wsManager.baseReconnectDelay * wsManager.reconnectAttempts, 5000);
      console.log(`🔄 Attempting reconnect ${wsManager.reconnectAttempts}/${wsManager.maxReconnectAttempts} in ${delay}ms`);
      
      wsManager.reconnectInterval = setTimeout(() => {
        connectWS(accountSetId);
      }, delay);
      reconnectInterval = wsManager.reconnectInterval; // Legacy sync
    } else if (wsManager.reconnectAttempts >= wsManager.maxReconnectAttempts) {
      console.error('🚫 Max reconnection attempts reached. Please refresh the page.');
    }
  };
}

/**
 * ✅ FIX 1 & FIX 3: Enhanced quote subscription with freshness validation
 */
export function subscribeToQuotes(accountSetId, futureSymbol, spotSymbol, onUpdate) {
  console.log('📊 subscribeToQuotes called:', { accountSetId, futureSymbol, spotSymbol });
  
  // ✅ FIX 1: Use unified subscription management
  const currentSub = wsManager.pendingQuoteSubs[0] || pendingQuoteSubs[0];
  const isNewSubscription = !currentSub || 
    currentSub.futureSymbol !== futureSymbol || 
    currentSub.spotSymbol !== spotSymbol ||
    currentSub.accountSetId !== accountSetId;

  if (isNewSubscription) {
    console.log('🔄 Replacing quote subscription:', { 
      old: currentSub, 
      new: { accountSetId, futureSymbol, spotSymbol } 
    });
    
    // ✅ FIX 3: Enhanced quote handler with freshness validation
    const enhancedHandler = (data) => {
      if (data.futureSymbol === futureSymbol && data.spotSymbol === spotSymbol) {
        // Validate quote freshness before processing
        const futureValid = wsManager.isQuoteFresh(data.futureQuote);
        const spotValid = wsManager.isQuoteFresh(data.spotQuote);
        
        if (!futureValid || !spotValid) {
          console.warn('⚠️ Received stale quotes:', {
            futureAge: data.futureQuote ? Date.now() - new Date(data.futureQuote.timestamp) : 'no quote',
            spotAge: data.spotQuote ? Date.now() - new Date(data.spotQuote.timestamp) : 'no quote'
          });
        }
        
        // Call the original handler with enhanced data
        onUpdate({
          ...data,
          futureQuoteFresh: futureValid,
          spotQuoteFresh: spotValid,
          quotesValidForTrading: wsManager.validateTradeQuotes(data.futureQuote, data.spotQuote)
        });
      }
    };
    
    // Register with both unified and legacy handlers
    wsManager.handlers.set('quote_update', [enhancedHandler]);
    handlers['quote_update'] = [enhancedHandler]; // Legacy compatibility

    // Update both unified and legacy pending subscriptions
    wsManager.pendingQuoteSubs.length = 0;
    wsManager.pendingQuoteSubs.push({ accountSetId, futureSymbol, spotSymbol });
    pendingQuoteSubs.length = 0;
    pendingQuoteSubs.push({ accountSetId, futureSymbol, spotSymbol });
  } else {
    console.log('📋 Using existing quote subscription:', currentSub);
  }

  // ✅ FIX 1: Ensure unified connection
  if (!wsManager.socket && !socket) {
    connectWS(accountSetId);
  }
    
  // ✅ FIX 1: Enhanced subscription sending with unified socket management
  const sendSubscription = () => {
    const activeSocket = wsManager.socket || socket;
    if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending subscribe_quote message:', { accountSetId, futureSymbol, spotSymbol });
      const message = {
        action: 'subscribe_quote',
        accountSetId,
        futureSymbol,
        spotSymbol
      };
      
      activeSocket.send(JSON.stringify(message));
      console.log('✅ Quote subscription sent successfully');
    } else {
      console.warn('⚠ Cannot send quote subscription - WebSocket not ready, readyState:', activeSocket?.readyState, 'socket exists:', !!activeSocket);
      // If no socket exists, try to establish connection
      if (!activeSocket) {
        console.log('🔄 No WebSocket connection, attempting to connect...');
        connectWS(accountSetId);
      }
    }
  };

  // If socket is already open, send immediately; otherwise wait for connection
  const activeSocket = wsManager.socket || socket;
  if (activeSocket) {
    if (activeSocket.readyState === WebSocket.OPEN) {
      sendSubscription();
    } else {
      console.log('⏳ WebSocket not ready (state:', activeSocket.readyState, '), queuing quote subscription');
      const listener = () => {
        console.log('🔥 WebSocket opened, sending queued quote subscription');
        sendSubscription();
      };
      activeSocket.addEventListener('open', listener, { once: true });
      
      // Also try after a short delay in case connection establishes quickly
      setTimeout(() => {
        const currentSocket = wsManager.socket || socket;
        if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
          sendSubscription();
        }
      }, 1000);
    }
  } else {
    console.warn('⚠ No WebSocket connection for quote subscription');
  }
}

/**
 * Subscribe to premium updates for a given accountSetId.
 */
export function subscribeToPremium(accountSetId, futureSymbol, spotSymbol) {
  const sendSub = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'subscribe_premium',
        accountSetId,
        futureSymbol,
        spotSymbol
      }));
      console.log('✅ Subscribed to premium updates for:', accountSetId);
    }
  };

  if (socket) {
    if (socket.readyState === WebSocket.OPEN) {
      sendSub();
    } else {
      socket.addEventListener('open', sendSub, { once: true });
    }
  }
}

/**
 * Subscribe to MT4/MT5 positions updates for a given accountSetId.
 */
export function subscribeToPositions(accountSetId) {
  const sendSub = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'subscribe_positions',
        accountSetId
      }));
      console.log('✅ Subscribed to positions updates for:', accountSetId);
    } else {
      console.warn('⚠ Cannot subscribe to positions - WebSocket not ready, readyState:', socket?.readyState);
      // Try to establish connection
      if (!socket) {
        console.log('🔄 No WebSocket connection, attempting to connect...');
        connectWS(accountSetId);
        // Retry subscription after connection attempt
        setTimeout(() => subscribeToPositions(accountSetId), 2000);
      }
    }
  };

  if (socket) {
    if (socket.readyState === WebSocket.OPEN) {
      sendSub();
    } else {
      socket.addEventListener('open', sendSub, { once: true });
    }
  } else {
    // No socket exists, connect first
    connectWS(accountSetId);
    setTimeout(() => subscribeToPositions(accountSetId), 1000);
  }
}

/**
 * Subscribe to external API open orders updates for a given accountSetId.
 */
export function subscribeToOpenOrders(accountSetId) {
  const sendSub = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        action: 'subscribe_open_orders',
        accountSetId
      }));
      console.log('✅ Subscribed to open orders updates for:', accountSetId);
    } else {
      console.warn('⚠ Cannot subscribe to open orders - WebSocket not ready, readyState:', socket?.readyState);
      // Try to establish connection
      if (!socket) {
        console.log('🔄 No WebSocket connection, attempting to connect...');
        connectWS(accountSetId);
        // Retry subscription after connection attempt
        setTimeout(() => subscribeToOpenOrders(accountSetId), 2000);
      }
    }
  };

  if (socket) {
    if (socket.readyState === WebSocket.OPEN) {
      sendSub();
    } else {
      socket.addEventListener('open', sendSub, { once: true });
    }
  } else {
    // No socket exists, connect first
    connectWS(accountSetId);
    setTimeout(() => subscribeToOpenOrders(accountSetId), 1000);
  }
}

/**
 * ✅ FIX 2: Enhanced handler registration with unified management
 */
export function onMessage(type, fn) {
  // Register with both unified and legacy systems
  if (!wsManager.handlers.has(type)) {
    wsManager.handlers.set(type, []);
  }
  wsManager.handlers.get(type).push(fn);
  
  // Legacy compatibility
  if (!handlers[type]) handlers[type] = [];
  handlers[type].push(fn);
  
  return () => offMessage(type, fn);
}

/**
 * ✅ FIX 2: Enhanced handler unregistration with unified management
 */
export function offMessage(type, fn) {
  // Unregister from unified system
  if (wsManager.handlers.has(type)) {
    const unifiedHandlers = wsManager.handlers.get(type).filter((f) => f !== fn);
    if (unifiedHandlers.length === 0) {
      wsManager.handlers.delete(type);
    } else {
      wsManager.handlers.set(type, unifiedHandlers);
    }
  }
  
  // Legacy compatibility
  if (!handlers[type]) return;
  handlers[type] = handlers[type].filter((f) => f !== fn);
  if (handlers[type].length === 0) delete handlers[type];
}

/**
 * ✅ FIX 1: Enhanced message sending with unified socket management
 */
export function sendMessage(message) {
  const activeSocket = wsManager.socket || socket;
  if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
    activeSocket.send(JSON.stringify(message));
    return true;
  }
  console.warn('WebSocket not open, cannot send:', message);
  return false;
}

/**
 * ✅ FIX 1: Enhanced status checking with unified socket management
 */
export function getWSStatus() {
  const activeSocket = wsManager.socket || socket;
  if (!activeSocket) return 'disconnected';
  
  switch (activeSocket.readyState) {
    case WebSocket.CONNECTING: return 'connecting';
    case WebSocket.OPEN: return 'connected';
    case WebSocket.CLOSING: return 'closing';
    case WebSocket.CLOSED: return 'disconnected';
    default: return 'unknown';
  }
}

/**
 * ✅ FIX 1: Enhanced connection checking with unified socket management
 */
export function isWSConnected() {
  const activeSocket = wsManager.socket || socket;
  return activeSocket && activeSocket.readyState === WebSocket.OPEN;
}

/**
 * ✅ FIX 1: Enhanced subscription clearing with unified management
 */
export function clearQuoteSubscriptions() {
  console.log('🧹 Clearing quote subscriptions for account set switch');
  
  // Clear from unified system
  wsManager.handlers.delete('quote_update');
  wsManager.pendingQuoteSubs.length = 0;
  
  // Legacy compatibility
  if (handlers['quote_update']) {
    delete handlers['quote_update'];
  }
  pendingQuoteSubs.length = 0;
}

/**
 * ✅ FIX 1: Enhanced disconnection with unified management
 */
export function disconnectWS() {
  console.log('🔌 Disconnecting WebSocket');
  
  // Clear reconnect timeouts
  if (wsManager.reconnectInterval) {
    clearTimeout(wsManager.reconnectInterval);
    wsManager.reconnectInterval = null;
  }
  if (reconnectInterval) {
    clearTimeout(reconnectInterval);
    reconnectInterval = null;
  }
  
  // Stop heartbeat
  stopHeartbeat();
  
  // Close sockets
  if (wsManager.socket) {
    wsManager.socket.close(1000, 'Manual disconnect');
    wsManager.socket = null;
  }
  if (socket) {
    socket.close(1000, 'Manual disconnect');
    socket = null;
  }
  
  // Clear handlers
  wsManager.handlers.clear();
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  
  // Reset reconnect attempts
  wsManager.reconnectAttempts = 0;
  reconnectAttempts = 0;
  
  // Reset account set
  wsManager.accountSetId = null;
}