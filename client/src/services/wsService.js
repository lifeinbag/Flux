// client/src/services/wsService.js

let socket = null;
// keep every quote sub around so we can replay it on reconnect
const pendingQuoteSubs = [];
let reconnectInterval = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 15;
const baseReconnectDelay = 1000;
let heartbeatInterval = null;
let lastPongTime = 0;
const handlers = {};

/**
 * Send heartbeat ping to server
 */
function sendHeartbeat() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action: 'ping', timestamp: Date.now() }));
  }
}

/**
 * Start heartbeat mechanism
 */
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    // Check if we missed a pong (no response for 45 seconds)
    if (lastPongTime > 0 && now - lastPongTime > 45000) {
      console.warn('💔 Heartbeat timeout - connection may be stale');
      if (socket) {
        socket.close(1000, 'Heartbeat timeout');
      }
      return;
    }
    sendHeartbeat();
  }, 20000); // Send ping every 20 seconds
}

/**
 * Stop heartbeat mechanism
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Connect (or reconnect) to the WS and subscribe to a given accountSetId.
 */
export function connectWS(accountSetId) {
  if (!accountSetId) {
    console.warn('🚫 connectWS: no accountSetId provided – skipping.');
    return;
  }

  console.log('🔗 Attempting WebSocket connection for account set:', accountSetId);

  // Tear down any existing connection
  if (socket) {
    socket.close();
    socket = null;
  }
  
  // Clear any existing reconnect attempts
  if (reconnectInterval) {
    clearTimeout(reconnectInterval);
    reconnectInterval = null;
  }

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

  // Create & store a single Socket reference
  socket = new WebSocket(WS_URL);
  const currentSocket = socket;

  // Connection opened
  currentSocket.onopen = () => {
    console.log('✅ WebSocket connection established');
    reconnectAttempts = 0; // Reset reconnect counter
    lastPongTime = Date.now(); // Initialize pong time
    startHeartbeat(); // Start heartbeat
    
    if (currentSocket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending subscribe_set message:', accountSetId);
      currentSocket.send(
        JSON.stringify({ action: 'subscribe_set', accountSetId })
      );
      
      // replay any quote subscriptions after (re)connect
      pendingQuoteSubs.forEach(sub => {
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

  // Message received
  socket.onmessage = (event) => {
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
      lastPongTime = Date.now();
      return;
    }

    // For balance messages, pass the entire message to maintain brokerId at root level
    const messagePayload = msg.type === 'balance' ? msg : (msg.data ?? msg.payload ?? msg);
    console.log('📦 Message payload for', msg.type + ':', messagePayload);

    // Call all registered handlers for this message type
    const fns = handlers[msg.type] || [];
    if (fns.length === 0) {
      console.warn('⚠ No handlers registered for message type:', msg.type);
    }
    
    fns.forEach((fn) => {
      try {
        fn(messagePayload);
      } catch (err) {
        console.error('❌ WS handler error for type', msg.type, ':', err);
      }
    });
  };

  // Connection error
  socket.onerror = (err) => {
    console.error('❌ WebSocket error:', err);
  };

  // Connection closed
  socket.onclose = (event) => {
    console.log('🔌 WebSocket connection closed:', event.code, event.reason);
    socket = null;
    stopHeartbeat(); // Stop heartbeat on close
    
    // Attempt to reconnect if not a normal closure
    if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      // Exponential backoff: 1s, 2s, 3s, 4s, 5s, then 5s max
      const delay = Math.min(baseReconnectDelay * reconnectAttempts, 5000);
      console.log(`🔄 Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`);
      
      reconnectInterval = setTimeout(() => {
        connectWS(accountSetId);
      }, delay);
    } else if (reconnectAttempts >= maxReconnectAttempts) {
      console.error('🚫 Max reconnection attempts reached. Please refresh the page.');
    }
  };
}

/**
 * Subscribe to quote updates for symbols
 */
export function subscribeToQuotes(accountSetId, futureSymbol, spotSymbol, onUpdate) {
  console.log('📊 subscribeToQuotes called:', { accountSetId, futureSymbol, spotSymbol });
  
  // ✅ SMART HANDLER REPLACEMENT: Only replace if symbols are different
  const currentSub = pendingQuoteSubs[0];
  const isNewSubscription = !currentSub || 
    currentSub.futureSymbol !== futureSymbol || 
    currentSub.spotSymbol !== spotSymbol ||
    currentSub.accountSetId !== accountSetId;

  if (isNewSubscription) {
    console.log('🔄 Replacing quote subscription:', { 
      old: currentSub, 
      new: { accountSetId, futureSymbol, spotSymbol } 
    });
    
    // Replace quote handlers
    handlers['quote_update'] = [data => {
      if (
        data.futureSymbol === futureSymbol &&
        data.spotSymbol   === spotSymbol
      ) {
        onUpdate(data);
      }
    }];

    // Replace pending subscriptions
    pendingQuoteSubs.length = 0;
    pendingQuoteSubs.push({ accountSetId, futureSymbol, spotSymbol });
  } else {
    console.log('📋 Using existing quote subscription:', currentSub);
  }

  // Ensure we have a socket connection
  if (!socket) {
    connectWS(accountSetId);
  }
    
  // Helper to send the subscription message
  const sendSubscription = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log('📤 Sending subscribe_quote message:', { accountSetId, futureSymbol, spotSymbol });
      const message = {
        action: 'subscribe_quote',
        accountSetId,
        futureSymbol,
        spotSymbol
      };
      
      socket.send(JSON.stringify(message));
      console.log('✅ Quote subscription sent successfully');
    } else {
      console.warn('⚠ Cannot send quote subscription - WebSocket not ready, readyState:', socket?.readyState, 'socket exists:', !!socket);
      // If no socket exists, try to establish connection
      if (!socket) {
        console.log('🔄 No WebSocket connection, attempting to connect...');
        connectWS(accountSetId);
      }
    }
  };

  // If socket is already open, send immediately; otherwise wait for connection
  if (socket) {
    if (socket.readyState === WebSocket.OPEN) {
      sendSubscription();
    } else {
      console.log('⏳ WebSocket not ready (state:', socket.readyState, '), queuing quote subscription');
      const listener = () => {
        console.log('🔥 WebSocket opened, sending queued quote subscription');
        sendSubscription();
      };
      socket.addEventListener('open', listener, { once: true });
      
      // Also try after a short delay in case connection establishes quickly
      setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
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
 * Register a handler for a given message type.
 * Returns an unsubscribe function.
 */
export function onMessage(type, fn) {
  if (!handlers[type]) handlers[type] = [];
  handlers[type].push(fn);
  return () => offMessage(type, fn);
}

/**
 * Unregister a handler.
 */
export function offMessage(type, fn) {
  if (!handlers[type]) return;
  handlers[type] = handlers[type].filter((f) => f !== fn);
  if (handlers[type].length === 0) delete handlers[type];
}

/**
 * Send an arbitrary message over the socket (guarded).
 */
export function sendMessage(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  }
  console.warn('WebSocket not open, cannot send:', message);
  return false;
}

/**
 * Get WebSocket connection status
 */
export function getWSStatus() {
  if (!socket) return 'disconnected';
  
  switch (socket.readyState) {
    case WebSocket.CONNECTING: return 'connecting';
    case WebSocket.OPEN: return 'connected';
    case WebSocket.CLOSING: return 'closing';
    case WebSocket.CLOSED: return 'disconnected';
    default: return 'unknown';
  }
}

/**
 * Check if WebSocket is connected
 */
export function isWSConnected() {
  return socket && socket.readyState === WebSocket.OPEN;
}

/**
 * Clear quote subscriptions only (for account set switching)
 */
export function clearQuoteSubscriptions() {
  console.log('🧹 Clearing quote subscriptions for account set switch');
  if (handlers['quote_update']) {
    delete handlers['quote_update'];
  }
  pendingQuoteSubs.length = 0;
}

/**
 * Fully disconnect and clear handlers.
 */
export function disconnectWS() {
  console.log('🔌 Disconnecting WebSocket');
  
  // Clear reconnect timeout
  if (reconnectInterval) {
    clearTimeout(reconnectInterval);
    reconnectInterval = null;
  }
  
  // Stop heartbeat
  stopHeartbeat();
  
  // Close socket
  if (socket) {
    socket.close(1000, 'Manual disconnect'); // Normal closure
    socket = null;
  }
  
  // Clear handlers
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  
  // Reset reconnect attempts
  reconnectAttempts = 0;
}