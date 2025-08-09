const { ActiveTrade, ClosedTrade, AccountSet, Broker } = require('../models');
const axios = require('axios');
const logger = require('../utils/logger');
const { TokenManager } = require('../token-manager');

class TradeStatusMonitor {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.checkInterval = 60000; // Check every minute
  }

  async start() {
    if (this.isRunning) {
      logger.info('Trade status monitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting trade status monitor...');
    
    // Run initial check
    await this.checkTradeStatuses();
    
    // Set up interval
    this.intervalId = setInterval(async () => {
      try {
        await this.checkTradeStatuses();
      } catch (error) {
        logger.error('Error in trade status check:', error);
      }
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Trade status monitor stopped');
  }

  async checkTradeStatuses() {
    try {
      logger.info('Checking active trade statuses...');

      // Get all active trades with their brokers
      const activeTrades = await ActiveTrade.findAll({
        where: { status: 'Active' },
        include: [
          {
            model: AccountSet,
            attributes: ['id', 'name']
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

      if (activeTrades.length === 0) {
        logger.info('No active trades to check');
        return;
      }

      logger.info(`Checking ${activeTrades.length} active trades...`);

      // Group brokers by terminal type to batch API calls
      const mt5Brokers = new Set();
      const mt4Brokers = new Set();

      activeTrades.forEach(trade => {
        if (trade.broker1?.terminal === 'MT5') mt5Brokers.add(trade.broker1);
        if (trade.broker1?.terminal === 'MT4') mt4Brokers.add(trade.broker1);
        if (trade.broker2?.terminal === 'MT5') mt5Brokers.add(trade.broker2);
        if (trade.broker2?.terminal === 'MT4') mt4Brokers.add(trade.broker2);
      });

      // Get all open positions for each broker
      const [mt5PositionsMap, mt4PositionsMap] = await Promise.all([
        this.getMT5PositionsForBrokers(Array.from(mt5Brokers)),
        this.getMT4PositionsForBrokers(Array.from(mt4Brokers))
      ]);

      // Check each active trade
      let movedCount = 0;
      for (const trade of activeTrades) {
        const mt5Ticket = trade.broker1?.terminal === 'MT5' ? 
          trade.broker1Ticket : trade.broker2Ticket;
        const mt4Ticket = trade.broker1?.terminal === 'MT4' ? 
          trade.broker1Ticket : trade.broker2Ticket;

        const mt5BrokerId = trade.broker1?.terminal === 'MT5' ? 
          trade.broker1.id : trade.broker2.id;
        const mt4BrokerId = trade.broker1?.terminal === 'MT4' ? 
          trade.broker1.id : trade.broker2.id;

        const mt5Positions = mt5PositionsMap.get(mt5BrokerId) || [];
        const mt4Positions = mt4PositionsMap.get(mt4BrokerId) || [];

        const mt5Open = mt5Positions.some(pos => pos.ticket?.toString() === mt5Ticket);
        const mt4Open = mt4Positions.some(pos => pos.ticket?.toString() === mt4Ticket);

        // If both trades are closed, move to closed trades
        if (!mt5Open && !mt4Open) {
          logger.info(`Trade ${trade.tradeId} is closed on both platforms, moving to closed trades`);
          
          try {
            await this.moveToClosedTrades(trade);
            this.broadcastTradeStatusChange(trade, 'closed', 'Both MT4 and MT5 positions closed');
            movedCount++;
          } catch (error) {
            logger.error(`Failed to move trade ${trade.tradeId} to closed:`, error);
          }
        }
      }

      if (movedCount > 0) {
        logger.info(`Moved ${movedCount} closed trades to closed_trades table`);
      } else {
        logger.info('No trades needed to be moved');
      }

    } catch (error) {
      logger.error('Error checking trade statuses:', error);
    }
  }

  async getMT5PositionsForBrokers(brokers) {
    const positionsMap = new Map();
    
    for (const broker of brokers) {
      try {
        const token = await this.getValidToken(broker, true);
        const positions = await this.getMT5OpenTrades(token);
        positionsMap.set(broker.id, positions);
      } catch (error) {
        logger.error(`Failed to get MT5 positions for broker ${broker.id}:`, error);
        positionsMap.set(broker.id, []);
      }
    }
    
    return positionsMap;
  }

  async getMT4PositionsForBrokers(brokers) {
    const positionsMap = new Map();
    
    for (const broker of brokers) {
      try {
        const token = await this.getValidToken(broker, false);
        const positions = await this.getMT4OpenTrades(token);
        positionsMap.set(broker.id, positions);
      } catch (error) {
        logger.error(`Failed to get MT4 positions for broker ${broker.id}:`, error);
        positionsMap.set(broker.id, []);
      }
    }
    
    return positionsMap;
  }

  async getValidToken(broker, isMT5) {
    const now = Date.now();
    
    // Check if current token is still valid (with 5-minute buffer)
    const tokenValid = broker.token && 
                      broker.tokenExpiresAt && 
                      new Date(broker.tokenExpiresAt).getTime() > (now + 300000);
    
    if (tokenValid) {
      return broker.token;
    }
    
    try {
      // Get new token using TokenManager
      const token = await TokenManager.getToken(
        isMT5,
        broker.server,
        broker.accountNumber,
        broker.password,
        broker.id
      );
      
      // Update broker with new token
      broker.token = token;
      broker.tokenExpiresAt = new Date(Date.now() + 22 * 60 * 60 * 1000);
      await broker.save();
      
      return token;
      
    } catch (error) {
      logger.error(`Failed to get token for broker ${broker.id}:`, error);
      throw error;
    }
  }

  // Broadcast trade status change to WebSocket clients
  broadcastTradeStatusChange(trade, status, reason = '') {
    try {
      // Use global app reference if available
      const app = global.app;
      const broadcastToAccountSet = app?.locals?.broadcastToAccountSet;
      
      if (broadcastToAccountSet && trade.accountSetId) {
        const message = {
          type: 'trade_status_update',
          data: {
            tradeId: trade.tradeId,
            accountSetId: trade.accountSetId,
            status: status, // 'closed', 'error', 'partially_filled'
            reason: reason,
            timestamp: new Date(),
            mt5Ticket: trade.broker1?.terminal === 'MT5' ? trade.broker1Ticket : trade.broker2Ticket,
            mt4Ticket: trade.broker1?.terminal === 'MT4' ? trade.broker1Ticket : trade.broker2Ticket
          }
        };
        
        broadcastToAccountSet(trade.accountSetId, message);
        logger.info(`Broadcasted trade status change: ${trade.tradeId} -> ${status}`);
      } else {
        logger.warn('WebSocket broadcast function not available');
      }
    } catch (error) {
      logger.error('Error broadcasting trade status change:', error);
    }
  }

  async getMT5OpenTrades(token) {
    try {
      const response = await axios.get('/OpenedOrders', {
        params: { id: token },
        baseURL: process.env.MT5_API_URL || 'https://mt5.fluxnetwork.one:443',
        timeout: 10000
      });
      return response.data.success !== false ? (response.data.data || response.data || []) : [];
    } catch (error) {
      logger.error('Error fetching MT5 open trades:', error);
      return [];
    }
  }

  async getMT4OpenTrades(token) {
    try {
      const response = await axios.get('/OpenedOrders', {
        params: { id: token },
        baseURL: process.env.MT4_API_URL || 'https://mt4.fluxnetwork.one:443',
        timeout: 10000
      });
      return response.data.success !== false ? (response.data.data || response.data || []) : [];
    } catch (error) {
      logger.error('Error fetching MT4 open trades:', error);
      return [];
    }
  }

  async moveToClosedTrades(activeTrade) {
    const transaction = await ActiveTrade.sequelize.transaction();
    
    try {
      // Create closed trade record
      await ClosedTrade.create({
        tradeId: activeTrade.tradeId,
        accountSetId: activeTrade.accountSetId,
        userId: activeTrade.userId,
        
        // Broker 1 details
        broker1Id: activeTrade.broker1Id,
        broker1Ticket: activeTrade.broker1Ticket,
        broker1Symbol: activeTrade.broker1Symbol,
        broker1Direction: activeTrade.broker1Direction,
        broker1Volume: activeTrade.broker1Volume,
        broker1OpenPrice: activeTrade.broker1OpenPrice,
        broker1OpenTime: activeTrade.broker1OpenTime,
        broker1CloseTime: new Date(),
        
        // Broker 2 details
        broker2Id: activeTrade.broker2Id,
        broker2Ticket: activeTrade.broker2Ticket,
        broker2Symbol: activeTrade.broker2Symbol,
        broker2Direction: activeTrade.broker2Direction,
        broker2Volume: activeTrade.broker2Volume,
        broker2OpenPrice: activeTrade.broker2OpenPrice,
        broker2OpenTime: activeTrade.broker2OpenTime,
        broker2CloseTime: new Date(),
        
        // Trade details
        executionPremium: activeTrade.executionPremium,
        closePremium: activeTrade.executionPremium, // Use execution premium as close premium if not available
        takeProfit: activeTrade.takeProfit,
        stopLoss: activeTrade.stopLoss,
        broker1Latency: activeTrade.broker1Latency,
        broker2Latency: activeTrade.broker2Latency,
        comment: activeTrade.comment,
        scalpingMode: activeTrade.scalpingMode,
        
        // Close details
        closeReason: 'System - Detected as closed',
        totalProfit: 0 // Will be calculated separately if needed
      }, { transaction });

      // Remove from active trades
      await activeTrade.destroy({ transaction });
      
      await transaction.commit();
      logger.info(`Successfully moved trade ${activeTrade.tradeId} to closed trades`);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

// Create singleton instance
const tradeStatusMonitor = new TradeStatusMonitor();

module.exports = tradeStatusMonitor;