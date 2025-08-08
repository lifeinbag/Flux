const { ActiveTrade, ClosedTrade, AccountSet, Broker } = require('../models');
const axios = require('axios');
const logger = require('../utils/logger');

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

      // Get all active trades
      const activeTrades = await ActiveTrade.findAll({
        include: [
          {
            model: AccountSet,
            attributes: ['id', 'name']
          },
          {
            model: Broker,
            as: 'broker1',
            attributes: ['id', 'terminal', 'server']
          },
          {
            model: Broker,
            as: 'broker2',
            attributes: ['id', 'terminal', 'server']
          }
        ]
      });

      if (activeTrades.length === 0) {
        logger.info('No active trades to check');
        return;
      }

      logger.info(`Checking ${activeTrades.length} active trades...`);

      // Get current open positions from MT4/MT5 APIs
      const [mt5OpenTrades, mt4OpenTrades] = await Promise.allSettled([
        this.getMT5OpenTrades(),
        this.getMT4OpenTrades()
      ]);

      const mt5Tickets = new Set();
      const mt4Tickets = new Set();

      if (mt5OpenTrades.status === 'fulfilled' && mt5OpenTrades.value) {
        mt5OpenTrades.value.forEach(trade => {
          mt5Tickets.add(trade.ticket.toString());
        });
      }

      if (mt4OpenTrades.status === 'fulfilled' && mt4OpenTrades.value) {
        mt4OpenTrades.value.forEach(trade => {
          mt4Tickets.add(trade.ticket.toString());
        });
      }

      logger.info(`Found ${mt5Tickets.size} open MT5 trades and ${mt4Tickets.size} open MT4 trades`);

      // Check each active trade
      let movedCount = 0;
      for (const trade of activeTrades) {
        const mt5Ticket = trade.broker1?.terminal === 'MT5' ? 
          trade.broker1Ticket : trade.broker2Ticket;
        const mt4Ticket = trade.broker1?.terminal === 'MT4' ? 
          trade.broker1Ticket : trade.broker2Ticket;

        const mt5Open = mt5Tickets.has(mt5Ticket);
        const mt4Open = mt4Tickets.has(mt4Ticket);

        // If both trades are closed, move to closed trades
        if (!mt5Open && !mt4Open) {
          logger.info(`Trade ${trade.tradeId} is closed on both platforms, moving to closed trades`);
          
          try {
            // First update status to 'Closed' before moving
            await trade.update({ status: 'Closed' });
            
            await this.moveToClosedTrades(trade);
            
            // Broadcast status change AFTER successful move
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

  async getMT5OpenTrades() {
    try {
      const response = await axios.get('/api/mt4mt5/mt5/opened-orders?id=mf2z4i5f-lzwv-yvj0-ilv2-1ooknlivluc0', {
        baseURL: process.env.BACKEND_URL || 'http://localhost:5000',
        timeout: 10000
      });
      return response.data.success ? response.data.data : [];
    } catch (error) {
      logger.error('Error fetching MT5 open trades:', error);
      return [];
    }
  }

  async getMT4OpenTrades() {
    try {
      const response = await axios.get('/api/mt4mt5/mt4/opened-orders?id=rjooxtv5-ybf5-y7ba-vj1x-l2gpc2s82tgt', {
        baseURL: process.env.BACKEND_URL || 'http://localhost:5000',
        timeout: 10000
      });
      return response.data.success ? response.data.data : [];
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