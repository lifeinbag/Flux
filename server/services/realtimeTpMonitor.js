const { ActiveTrade, ClosedTrade, AccountSet, Broker } = require('../models');
const axios = require('axios');
const logger = require('../utils/logger');
const { TokenManager } = require('../token-manager');

class RealtimeTpMonitor {
  constructor() {
    this.activeTrades = new Map(); // Cache of active trades with TP
    this.isRunning = false;
    this.checkInterval = 5000; // Check every 5 seconds for real-time monitoring
    this.intervalId = null;
    this.wsClients = new Set(); // WebSocket clients for broadcasting
  }

  async start() {
    if (this.isRunning) {
      logger.info('Realtime TP monitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting realtime TP monitor (5-second intervals)...');
    
    // Load active trades with TP
    await this.loadActiveTrades();
    
    // Start monitoring loop
    this.intervalId = setInterval(async () => {
      try {
        await this.checkTakeProfits();
      } catch (error) {
        logger.error('Error in realtime TP check:', error);
      }
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.activeTrades.clear();
    logger.info('🛑 Realtime TP monitor stopped');
  }

  // Add WebSocket client for broadcasting
  addWebSocketClient(ws) {
    this.wsClients.add(ws);
    logger.info(`TP Monitor: Added WebSocket client, total: ${this.wsClients.size}`);
    
    ws.on('close', () => {
      this.wsClients.delete(ws);
      logger.info(`TP Monitor: Removed WebSocket client, total: ${this.wsClients.size}`);
    });
  }

  // Broadcast TP events to WebSocket clients
  broadcastTPEvent(event, data) {
    const message = JSON.stringify({ type: 'tp_event', event, data });
    this.wsClients.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    });
  }

  // Load active trades that have TP set
  async loadActiveTrades() {
    try {
      const trades = await ActiveTrade.findAll({
        where: { 
          status: ['Active', 'PartiallyFilled'],
          takeProfitMode: ['Premium', 'Amount'] // Only trades with TP set
        },
        include: [
          {
            model: AccountSet,
            attributes: ['id', 'name', 'futureSymbol', 'spotSymbol']
          },
          {
            model: Broker,
            as: 'broker1',
            attributes: ['id', 'terminal', 'server', 'accountNumber', 'password', 'token', 'tokenExpiresAt']
          },
          {
            model: Broker,
            as: 'broker2', 
            attributes: ['id', 'terminal', 'server', 'accountNumber', 'password', 'token', 'tokenExpiresAt']
          }
        ]
      });

      // Cache the trades
      this.activeTrades.clear();
      trades.forEach(trade => {
        this.activeTrades.set(trade.tradeId, trade);
      });

      logger.info(`📊 Loaded ${trades.length} active trades with TP for monitoring`);
    } catch (error) {
      logger.error('Error loading active trades for TP monitoring:', error);
    }
  }

  // Add a new trade to monitoring
  async addTradeToMonitoring(tradeId) {
    try {
      const trade = await ActiveTrade.findOne({
        where: { tradeId },
        include: [
          { model: AccountSet, attributes: ['id', 'name', 'futureSymbol', 'spotSymbol'] },
          { model: Broker, as: 'broker1', attributes: ['id', 'terminal', 'server', 'accountNumber', 'password', 'token', 'tokenExpiresAt'] },
          { model: Broker, as: 'broker2', attributes: ['id', 'terminal', 'server', 'accountNumber', 'password', 'token', 'tokenExpiresAt'] }
        ]
      });

      if (trade && trade.takeProfitMode !== 'None') {
        this.activeTrades.set(tradeId, trade);
        logger.info(`➕ Added trade ${tradeId} to TP monitoring`);
      }
    } catch (error) {
      logger.error(`Error adding trade ${tradeId} to TP monitoring:`, error);
    }
  }

  // Remove trade from monitoring
  removeTradeFromMonitoring(tradeId) {
    if (this.activeTrades.has(tradeId)) {
      this.activeTrades.delete(tradeId);
      logger.info(`➖ Removed trade ${tradeId} from TP monitoring`);
    }
  }

  // Main TP checking logic
  async checkTakeProfits() {
    if (this.activeTrades.size === 0) {
      return; // No trades to monitor
    }

    logger.info(`🔍 Checking TP conditions for ${this.activeTrades.size} trades...`);

    for (const [tradeId, trade] of this.activeTrades) {
      try {
        // Get current positions for both brokers
        const [broker1Positions, broker2Positions] = await Promise.all([
          this.getBrokerPositions(trade.broker1),
          this.getBrokerPositions(trade.broker2)
        ]);

        // Check if both positions still exist
        const broker1Position = broker1Positions.find(pos => pos.ticket?.toString() === trade.broker1Ticket);
        const broker2Position = broker2Positions.find(pos => pos.ticket?.toString() === trade.broker2Ticket);

        if (!broker1Position || !broker2Position) {
          // Trade is closed externally, remove from monitoring
          logger.info(`Trade ${tradeId} closed externally, removing from TP monitoring`);
          this.removeTradeFromMonitoring(tradeId);
          continue;
        }

        // Check TP conditions
        const shouldTriggerTP = await this.checkTakeProfitCondition(trade, broker1Position, broker2Position);
        
        if (shouldTriggerTP) {
          logger.info(`🎯 INSTANT TP TRIGGER for trade ${tradeId}!`);
          
          // Remove from monitoring first to prevent double execution
          this.removeTradeFromMonitoring(tradeId);
          
          // Execute TP immediately
          await this.executeTakeProfit(trade);
        }
      } catch (error) {
        logger.error(`Error checking TP for trade ${tradeId}:`, error);
      }
    }
  }

  // Get positions for a broker
  async getBrokerPositions(broker) {
    try {
      const token = await this.getValidToken(broker);
      const apiUrl = broker.terminal === 'MT4' ? 
        'https://mt4.premiumprofit.live' : 'https://mt5.premiumprofit.live';
      
      const response = await axios.get(`${apiUrl}/OpenedOrders`, {
        params: { id: token },
        timeout: 10000
      });
      
      return response.data || [];
    } catch (error) {
      logger.error(`Error getting ${broker.terminal} positions for broker ${broker.id}:`, error);
      return [];
    }
  }

  // Get valid token for broker
  async getValidToken(broker) {
    const now = Date.now();
    const tokenValid = broker.token && 
                      broker.tokenExpiresAt && 
                      new Date(broker.tokenExpiresAt).getTime() > now;
    
    if (tokenValid) {
      return broker.token;
    }
    
    // Get fresh token
    const token = await TokenManager.getToken(
      broker.terminal === 'MT5',
      broker.server,
      broker.accountNumber,
      broker.password,
      broker.id
    );
    
    // Update broker token
    broker.token = token;
    broker.tokenExpiresAt = new Date(Date.now() + 22 * 60 * 60 * 1000);
    await broker.save();
    
    return token;
  }

  // Check TP condition for a specific trade
  async checkTakeProfitCondition(trade, broker1Position, broker2Position) {
    const takeProfitValue = parseFloat(trade.takeProfit);
    
    if (trade.takeProfitMode === 'Premium') {
      // Get current premium
      const currentPremium = await this.getCurrentPremium(trade);
      if (currentPremium === null) return false;
      
      const deficitPremium = parseFloat(trade.executionPremium) - currentPremium;
      const shouldTrigger = deficitPremium >= takeProfitValue;
      
      logger.info(`TP Check ${trade.tradeId}: Premium mode - Deficit: ${deficitPremium.toFixed(5)} vs Target: ${takeProfitValue} = ${shouldTrigger ? 'TRIGGER' : 'WAIT'}`);
      return shouldTrigger;
      
    } else if (trade.takeProfitMode === 'Amount') {
      // Calculate total profit from positions
      const broker1Profit = parseFloat(broker1Position.profit || 0);
      const broker2Profit = parseFloat(broker2Position.profit || 0);
      const totalProfit = broker1Profit + broker2Profit;
      
      const shouldTrigger = totalProfit >= takeProfitValue;
      
      logger.info(`TP Check ${trade.tradeId}: Amount mode - Current: $${totalProfit.toFixed(2)} vs Target: $${takeProfitValue} = ${shouldTrigger ? 'TRIGGER' : 'WAIT'}`);
      
      // Broadcast real-time profit update
      this.broadcastTPEvent('profit_update', {
        tradeId: trade.tradeId,
        currentProfit: totalProfit,
        targetProfit: takeProfitValue,
        shouldTrigger
      });
      
      return shouldTrigger;
    }
    
    return false;
  }

  // Get current premium for premium-based TP
  async getCurrentPremium(trade) {
    try {
      const [broker1Token, broker2Token] = await Promise.all([
        this.getValidToken(trade.broker1),
        this.getValidToken(trade.broker2)
      ]);
      
      const broker1ApiUrl = trade.broker1.terminal === 'MT4' ? 
        'https://mt4.premiumprofit.live' : 'https://mt5.premiumprofit.live';
      const broker2ApiUrl = trade.broker2.terminal === 'MT4' ? 
        'https://mt4.premiumprofit.live' : 'https://mt5.premiumprofit.live';
      
      const [futureQuote, spotQuote] = await Promise.all([
        axios.get(`${broker1ApiUrl}/GetQuote`, {
          params: { id: broker1Token, symbol: trade.broker1Symbol }
        }),
        axios.get(`${broker2ApiUrl}/GetQuote`, {
          params: { id: broker2Token, symbol: trade.broker2Symbol }  
        })
      ]);
      
      const futureBid = parseFloat(futureQuote.data.bid);
      const futureAsk = parseFloat(futureQuote.data.ask);
      const spotBid = parseFloat(spotQuote.data.bid);
      const spotAsk = parseFloat(spotQuote.data.ask);
      
      // Calculate premium based on trade direction
      let premium;
      if (trade.broker1Direction === 'Buy') {
        premium = futureAsk - spotBid;
      } else {
        premium = futureBid - spotAsk;
      }
      
      return premium;
    } catch (error) {
      logger.error(`Error getting current premium for trade ${trade.tradeId}:`, error);
      return null;
    }
  }

  // Execute take profit with accurate closing premium
  async executeTakeProfit(trade) {
    try {
      logger.info(`🎯 Executing instant TP for trade ${trade.tradeId}`);
      
      // Get current premium BEFORE closing (for accurate closing premium)
      const closingPremium = await this.getCurrentPremium(trade) || 0;
      
      const [broker1Token, broker2Token] = await Promise.all([
        this.getValidToken(trade.broker1),
        this.getValidToken(trade.broker2)
      ]);

      // Close both positions simultaneously
      const closeResults = await Promise.allSettled([
        this.closePosition(trade.broker1, broker1Token, trade.broker1Ticket, trade.broker1Volume),
        this.closePosition(trade.broker2, broker2Token, trade.broker2Ticket, trade.broker2Volume)
      ]);

      // Process close results
      const closedPositions = [];
      let totalProfit = 0;
      
      closeResults.forEach((result, index) => {
        const brokerName = index === 0 ? 'Broker1' : 'Broker2';
        if (result.status === 'fulfilled' && result.value.success) {
          closedPositions.push(result.value);
          totalProfit += parseFloat(result.value.data.profit || 0);
          logger.info(`✅ ${brokerName} closed successfully: $${result.value.data.profit}`);
        } else {
          logger.error(`❌ ${brokerName} close failed:`, result.reason);
        }
      });

      // Move to closed trades with accurate closing premium
      await this.moveToClosedTrades(trade, closingPremium, totalProfit, closeResults);
      
      // Broadcast TP execution event
      this.broadcastTPEvent('tp_executed', {
        tradeId: trade.tradeId,
        closingPremium,
        totalProfit,
        mode: trade.takeProfitMode
      });
      
      logger.info(`🎉 TP executed for trade ${trade.tradeId} - Profit: $${totalProfit.toFixed(2)}, Closing Premium: ${closingPremium.toFixed(5)}`);

    } catch (error) {
      logger.error(`Failed to execute TP for trade ${trade.tradeId}:`, error);
    }
  }

  // Close a single position
  async closePosition(broker, token, ticket, volume) {
    const apiUrl = broker.terminal === 'MT4' ? 
      'https://mt4.premiumprofit.live' : 'https://mt5.premiumprofit.live';
    
    const response = await axios.get(`${apiUrl}/OrderClose`, {
      params: {
        id: token,
        ticket: ticket,
        lots: volume,
        price: 0,
        slippage: 0
      },
      timeout: 15000
    });
    
    return {
      success: true,
      data: response.data,
      broker: broker.terminal,
      ticket: ticket
    };
  }

  // Move trade to closed_trades with accurate closing premium
  async moveToClosedTrades(trade, closingPremium, totalProfit, closeResults) {
    const transaction = await ActiveTrade.sequelize.transaction();
    
    try {
      await ClosedTrade.create({
        tradeId: trade.tradeId,
        accountSetId: trade.accountSetId,
        userId: trade.userId,
        
        // Broker details
        broker1Id: trade.broker1Id,
        broker1Ticket: trade.broker1Ticket,
        broker1Symbol: trade.broker1Symbol,
        broker1Direction: trade.broker1Direction,
        broker1Volume: trade.broker1Volume,
        broker1OpenPrice: trade.broker1OpenPrice,
        broker1OpenTime: trade.broker1OpenTime,
        broker1CloseTime: new Date(),
        broker1Profit: closeResults[0]?.status === 'fulfilled' ? closeResults[0].value?.data?.profit || 0 : 0,
        
        broker2Id: trade.broker2Id,
        broker2Ticket: trade.broker2Ticket,
        broker2Symbol: trade.broker2Symbol,
        broker2Direction: trade.broker2Direction,
        broker2Volume: trade.broker2Volume,
        broker2OpenPrice: trade.broker2OpenPrice,
        broker2OpenTime: trade.broker2OpenTime,
        broker2CloseTime: new Date(),
        broker2Profit: closeResults[1]?.status === 'fulfilled' ? closeResults[1].value?.data?.profit || 0 : 0,
        
        // Trade details with ACCURATE closing premium
        executionPremium: trade.executionPremium,
        closePremium: closingPremium, // 🎯 This was the missing piece!
        takeProfit: trade.takeProfit,
        takeProfitMode: trade.takeProfitMode,
        stopLoss: trade.stopLoss,
        broker1Latency: trade.broker1Latency,
        broker2Latency: trade.broker2Latency,
        comment: trade.comment,
        scalpingMode: trade.scalpingMode,
        
        // Close details
        closeReason: 'TakeProfit',
        totalProfit: totalProfit,
        tradeDurationMinutes: Math.floor((Date.now() - new Date(trade.createdAt).getTime()) / (1000 * 60))
      }, { transaction });

      // Remove from active trades
      await trade.destroy({ transaction });
      
      await transaction.commit();
      logger.info(`📝 Trade ${trade.tradeId} moved to closed_trades with closing premium: ${closingPremium.toFixed(5)}`);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

// Create singleton instance
const realtimeTpMonitor = new RealtimeTpMonitor();

module.exports = realtimeTpMonitor;