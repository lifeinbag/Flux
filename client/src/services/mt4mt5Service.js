// MT4/MT5 Service for Active Trades (WebSocket optimized)
import API from './api';
import { onMessage, sendMessage, isWSConnected } from './wsService';

class MT4MT5Service {
  constructor() {
    this.dataCache = new Map(); // Map<accountSetId, {mt5Data, mt4Data}>
    this.listeners = new Set();
    this.accountSetConfigs = new Map(); // Map<accountSetId, {mt4Id, mt5Id, futureSymbol, spotSymbol}>
    this.premiumData = new Map(); // Map<accountSetId, {sellPremium, buyPremium, futureQuote, spotQuote}>
    this.wsSubscriptions = new Map(); // Map<accountSetId, unsubscribeFunctions[]>
    this.initialized = false;
  }

  // Initialize WebSocket subscriptions if not already done
  initializeWebSocketSubscriptions() {
    if (this.initialized) return;

    console.log('🔌 Initializing MT4/MT5 WebSocket subscriptions...');

    // Subscribe to positions updates
    const unsubscribePositions = onMessage('positions_update', (data) => {
      console.log('📦 Received positions update:', data);
      console.log('🔍 Position data details:', {
        accountSetId: data.accountSetId,
        mt5Count: data.mt5Data?.length || 0,
        mt4Count: data.mt4Data?.length || 0,
        mt5Sample: data.mt5Data?.[0],
        mt4Sample: data.mt4Data?.[0],
        mt5AllTickets: data.mt5Data?.map(t => t.ticket) || [],
        mt4AllTickets: data.mt4Data?.map(t => t.ticket) || [],
        rawMt4Data: data.mt4Data,
        rawMt5Data: data.mt5Data
      });
      
      if (data.accountSetId) {
        const previousCache = this.dataCache.get(data.accountSetId);
        console.log('🔄 Cache update comparison:', {
          accountSetId: data.accountSetId,
          previous: {
            mt5Count: previousCache?.mt5Data?.length || 0,
            mt4Count: previousCache?.mt4Data?.length || 0,
            mt5Tickets: previousCache?.mt5Data?.map(t => t.ticket) || [],
            mt4Tickets: previousCache?.mt4Data?.map(t => t.ticket) || []
          },
          new: {
            mt5Count: data.mt5Data?.length || 0,
            mt4Count: data.mt4Data?.length || 0,
            mt5Tickets: data.mt5Data?.map(t => t.ticket) || [],
            mt4Tickets: data.mt4Data?.map(t => t.ticket) || []
          }
        });
        
        this.dataCache.set(data.accountSetId, {
          mt5Data: data.mt5Data || [],
          mt4Data: data.mt4Data || []
        });
        console.log('💾 Updated cache for account set:', data.accountSetId);
        console.log('💾 Current cache state:', {
          totalAccountSets: this.dataCache.size,
          accountSets: Array.from(this.dataCache.keys())
        });
        this.notifyListeners();
      }
    });

    // Subscribe to premium updates (enhanced with buy premium)
    const unsubscribePremium = onMessage('premium_update', (data) => {
      console.log('💰 Received premium update:', data);
      if (data.accountSetId) {
        this.premiumData.set(data.accountSetId, {
          sellPremium: data.sellpremium,
          buyPremium: data.buypremium,
          futureQuote: data.futureQuote,
          spotQuote: data.spotQuote,
          timestamp: data.timestamp
        });
        this.notifyListeners();
      }
    });

    // Subscribe to trade status updates
    const unsubscribeTradeStatus = onMessage('trade_status_update', (data) => {
      console.log('🔄 Received trade status update:', data);
      // Notify listeners about trade status changes
      this.notifyListeners({ tradeStatusUpdate: data });
    });

    // Store unsubscribe functions
    this.globalUnsubscribes = [unsubscribePositions, unsubscribePremium, unsubscribeTradeStatus];
    this.initialized = true;
  }

  // Initialize service for a specific account set
  async initializeAccountSet(accountSetId) {
    try {
      console.log('🎯 Initializing MT4/MT5 service for account set:', accountSetId);
      
      // Initialize WebSocket subscriptions (once)
      this.initializeWebSocketSubscriptions();
      
      // Get account set details including broker configurations
      console.log('🔄 Fetching account set details from API...');
      const response = await API.get(`/account-sets/${accountSetId}`);
      console.log('📦 Account set API response:', response.data);
      
      const accountSet = response.data.data || response.data;
      
      if (!accountSet || !accountSet.brokers || accountSet.brokers.length < 2) {
        console.error('❌ Account set validation failed:', {
          accountSetExists: !!accountSet,
          brokersExists: !!(accountSet?.brokers),
          brokersCount: accountSet?.brokers?.length || 0,
          accountSetId
        });
        return;
      }
      
      console.log('✅ Account set loaded successfully:', {
        id: accountSet.id,
        name: accountSet.name,
        brokerCount: accountSet.brokers.length,
        futureSymbol: accountSet.futureSymbol,
        spotSymbol: accountSet.spotSymbol
      });

      // Find MT4 and MT5 brokers
      const mt5Broker = accountSet.brokers.find(b => b.terminal === 'MT5');
      const mt4Broker = accountSet.brokers.find(b => b.terminal === 'MT4');

      if (!mt5Broker || !mt4Broker) {
        console.warn('Missing MT4 or MT5 broker in account set:', accountSetId);
        return;
      }

      // Store configuration using actual broker tokens instead of hardcoded IDs
      this.accountSetConfigs.set(accountSetId, {
        mt5Id: mt5Broker.token,  // Use actual token from database
        mt4Id: mt4Broker.token,  // Use actual token from database
        futureSymbol: accountSet.futureSymbol,
        spotSymbol: accountSet.spotSymbol,
        mt5Broker,
        mt4Broker
      });
      
      console.log('💾 Stored account set configuration:', {
        accountSetId,
        mt5Token: mt5Broker.token ? 'Present' : 'Missing',
        mt4Token: mt4Broker.token ? 'Present' : 'Missing',
        futureSymbol: accountSet.futureSymbol,
        spotSymbol: accountSet.spotSymbol
      });

      // Subscribe to WebSocket updates for this account set
      await this.subscribeToWebSocketUpdates(accountSetId);
      
    } catch (error) {
      console.error('Error initializing account set:', error);
    }
  }

  // Subscribe to WebSocket updates for specific account set
  async subscribeToWebSocketUpdates(accountSetId) {
    console.log('📡 Attempting to subscribe to WebSocket updates for account set:', accountSetId);
    
    if (!isWSConnected()) {
      console.warn('⚠️ WebSocket not connected, cannot subscribe to positions. Current status:', {
        isConnected: isWSConnected(),
        accountSetId: accountSetId
      });
      return;
    }

    console.log('📤 Sending subscribe_positions message to WebSocket...');

    // Subscribe to positions updates
    const success = sendMessage({
      action: 'subscribe_positions',
      accountSetId: accountSetId
    });

    if (success) {
      console.log('✅ Subscribed to positions updates for account set:', accountSetId);
    } else {
      console.error('❌ Failed to send subscribe_positions message');
    }
  }

  // Note: Removed hardcoded getMT5ApiId() and getMT4ApiId() methods.  
  // Now using actual broker tokens from the database instead.



  // Check if trade is still open
  isTradeStillOpen(accountSetId, mt5Ticket, mt4Ticket) {
    console.log('🔍 Checking if trade is still open:', { accountSetId, mt5Ticket, mt4Ticket });
    
    const cache = this.dataCache.get(accountSetId);
    console.log('📦 Cache for account set:', accountSetId, cache);
    
    const mt5Trade = this.getMT5TradeData(accountSetId, mt5Ticket);
    const mt4Trade = this.getMT4TradeData(accountSetId, mt4Ticket);
    
    const mt5Open = mt5Trade !== null;
    const mt4Open = mt4Trade !== null;
    
    console.log('🔍 Trade status check results:', {
      mt5Ticket,
      mt4Ticket,
      mt5Trade: mt5Trade ? { ticket: mt5Trade.ticket, symbol: mt5Trade.symbol } : null,
      mt4Trade: mt4Trade ? { ticket: mt4Trade.ticket, symbol: mt4Trade.symbol } : null,
      mt5Open,
      mt4Open,
      stillOpen: mt5Open || mt4Open
    });
    
    return mt5Open || mt4Open;
  }

  // Calculate trade profits for account set
  calculateTradeProfit(accountSetId, mt5Ticket, mt4Ticket) {
    console.log('🧮 Calculating profits for:', { accountSetId, mt5Ticket, mt4Ticket });
    
    const mt5Trade = this.getMT5TradeData(accountSetId, mt5Ticket);
    const mt4Trade = this.getMT4TradeData(accountSetId, mt4Ticket);

    console.log('📊 Trade data found:', { 
      mt5Trade: mt5Trade ? { ticket: mt5Trade.ticket, profit: mt5Trade.profit, swap: mt5Trade.swap } : null,
      mt4Trade: mt4Trade ? { ticket: mt4Trade.ticket, profit: mt4Trade.profit, swap: mt4Trade.swap } : null
    });

    const mt5Profit = mt5Trade ? (mt5Trade.profit || 0) : 0;
    const mt4Profit = mt4Trade ? (mt4Trade.profit || 0) : 0;
    const mt5Swap = mt5Trade ? (mt5Trade.swap || 0) : 0;
    const mt4Swap = mt4Trade ? (mt4Trade.swap || 0) : 0;

    const result = {
      mt5Profit,
      mt4Profit,
      mt5Swap,
      mt4Swap,
      totalProfit: mt5Profit + mt4Profit + mt5Swap + mt4Swap,
      totalSwap: mt5Swap + mt4Swap
    };
    
    console.log('💰 Calculated profits:', result);
    return result;
  }

  // Set premium data from WebSocket (called from TradeExecution or other components)
  setPremiumData(accountSetId, premiumData) {
    console.log('📝 Setting premium data for account set:', accountSetId, premiumData);
    this.premiumData.set(accountSetId, premiumData);
    this.notifyListeners();
  }

  // Get current premium data for account set
  getPremiumData(accountSetId) {
    return this.premiumData.get(accountSetId) || null;
  }

  // Calculate current premium and deficit
  calculatePremiumData(accountSetId, direction, openingPremium) {
    const premiumData = this.getPremiumData(accountSetId);
    if (!premiumData) {
      return {
        currentPremium: 0,
        deficitPremium: 0
      };
    }

    // Use sell premium for Buy direction, buy premium for Sell direction
    const currentPremium = direction === 'Buy' ? 
      (premiumData.sellPremium || 0) : 
      (premiumData.buyPremium || 0);
    
    const deficitPremium = currentPremium - parseFloat(openingPremium || 0);

    return {
      currentPremium,
      deficitPremium
    };
  }

  // Subscribe to data updates
  subscribe(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Notify all listeners
  notifyListeners(additionalData = {}) {
    this.listeners.forEach(callback => {
      try {
        callback({
          dataCache: this.dataCache,
          premiumData: this.premiumData,
          ...additionalData
        });
      } catch (error) {
        console.error('Error in listener callback:', error);
      }
    });
  }

  // Stop all WebSocket subscriptions and cleanup
  disconnect() {
    console.log('🔌 Disconnecting MT4/MT5 service...');
    
    // Unsubscribe from all WebSocket messages
    if (this.globalUnsubscribes) {
      this.globalUnsubscribes.forEach(unsubscribe => unsubscribe());
      this.globalUnsubscribes = [];
    }
    
    // Clear all data
    this.dataCache.clear();
    this.accountSetConfigs.clear();
    this.premiumData.clear();
    this.wsSubscriptions.clear();
    this.initialized = false;
    
    console.log('✅ MT4/MT5 service disconnected');
  }

  // Legacy methods for backward compatibility
  connect() {
    console.warn('MT4MT5Service.connect() is deprecated. Use initializeAccountSet(accountSetId) instead.');
  }

  // These methods are overloaded - if called with 1 param, it's legacy (deprecated)
  // If called with 2 params, it's the new API
  getMT5TradeData(...args) {
    if (args.length === 1) {
      console.warn('MT4MT5Service.getMT5TradeData(ticket) is deprecated. Use getMT5TradeData(accountSetId, ticket) instead.');
      return null;
    }
    const [accountSetId, ticket] = args;
    if (!ticket) {
      console.log('🔍 getMT5TradeData: No ticket provided');
      return null;
    }
    
    const cache = this.dataCache.get(accountSetId);
    if (!cache || !cache.mt5Data) {
      console.log('🔍 getMT5TradeData: No cache or MT5 data for account set:', accountSetId);
      return null;
    }
    
    console.log('🔍 getMT5TradeData: Searching for ticket', ticket, 'in', cache.mt5Data.length, 'MT5 trades');
    console.log('🔍 Available MT5 tickets:', cache.mt5Data.map(t => t.ticket));
    
    const trade = cache.mt5Data.find(trade => trade.ticket === parseInt(ticket));
    console.log('🔍 getMT5TradeData result:', trade ? `Found trade ${trade.ticket}` : `No trade found for ticket ${ticket}`);
    
    return trade;
  }

  getMT4TradeData(...args) {
    if (args.length === 1) {
      console.warn('MT4MT5Service.getMT4TradeData(ticket) is deprecated. Use getMT4TradeData(accountSetId, ticket) instead.');
      return null;
    }
    const [accountSetId, ticket] = args;
    if (!ticket) {
      console.log('🔍 getMT4TradeData: No ticket provided');
      return null;
    }
    
    const cache = this.dataCache.get(accountSetId);
    if (!cache || !cache.mt4Data) {
      console.log('🔍 getMT4TradeData: No cache or MT4 data for account set:', accountSetId);
      return null;
    }
    
    console.log('🔍 getMT4TradeData: Searching for ticket', ticket, 'in', cache.mt4Data.length, 'MT4 trades');
    console.log('🔍 Available MT4 tickets:', cache.mt4Data.map(t => t.ticket));
    
    const trade = cache.mt4Data.find(trade => {
      const tradeTicket = parseInt(trade.ticket);
      const searchTicket = parseInt(ticket);
      console.log('🔍 Comparing tickets:', { tradeTicket, searchTicket, match: tradeTicket === searchTicket });
      return tradeTicket === searchTicket;
    });
    console.log('🔍 getMT4TradeData result:', trade ? `Found trade ${trade.ticket} with profit ${trade.profit}` : `No trade found for ticket ${ticket}`);
    
    return trade;
  }
}

// Create singleton instance
const mt4mt5Service = new MT4MT5Service();

export default mt4mt5Service;