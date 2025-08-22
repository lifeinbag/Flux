const { ActiveTrade, ClosedTrade } = require('../models');
const logger = require('../utils/logger');

class DatabaseCleanupService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.cleanupInterval = 300000; // Run every 5 minutes
  }

  start() {
    if (this.isRunning) {
      logger.info('Database cleanup service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting database cleanup service...');
    
    // Run initial cleanup
    this.performCleanup();
    
    // Set up interval
    this.intervalId = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        logger.error('Error in database cleanup:', error);
      }
    }, this.cleanupInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Database cleanup service stopped');
  }

  async performCleanup() {
    try {
      // Move completed trades from active_trades to closed_trades (keep closed_trades forever)
      const completedTrades = await ActiveTrade.findAll({
        where: { status: 'Closed' }
      });

      if (completedTrades.length === 0) {
        return;
      }

      logger.info(`Moving ${completedTrades.length} completed trades to closed_trades table`);

      for (const trade of completedTrades) {
        try {
          // Check if already exists in closed_trades
          const existingClosedTrade = await ClosedTrade.findOne({
            where: { tradeId: trade.tradeId }
          });

          if (!existingClosedTrade) {
            // Move to closed_trades
            await ClosedTrade.create({
              tradeId: trade.tradeId,
              accountSetId: trade.accountSetId,
              userId: trade.userId,
              broker1Id: trade.broker1Id,
              broker1Ticket: trade.broker1Ticket,
              broker1Symbol: trade.broker1Symbol,
              broker1Direction: trade.broker1Direction,
              broker1Volume: trade.broker1Volume,
              broker1OpenPrice: trade.broker1OpenPrice,
              broker1OpenTime: trade.broker1OpenTime,
              broker1CloseTime: new Date(),
              broker2Id: trade.broker2Id,
              broker2Ticket: trade.broker2Ticket,
              broker2Symbol: trade.broker2Symbol,
              broker2Direction: trade.broker2Direction,
              broker2Volume: trade.broker2Volume,
              broker2OpenPrice: trade.broker2OpenPrice,
              broker2OpenTime: trade.broker2OpenTime,
              broker2CloseTime: new Date(),
              executionPremium: trade.executionPremium,
              closePremium: trade.executionPremium,
              takeProfit: trade.takeProfit,
              stopLoss: trade.stopLoss,
              broker1Latency: trade.broker1Latency,
              broker2Latency: trade.broker2Latency,
              comment: trade.comment,
              scalpingMode: trade.scalpingMode,
              closeReason: 'Trade completed',
              totalProfit: 0
            });
          }

          // Remove from active_trades
          await trade.destroy();
          logger.info(`Moved completed trade ${trade.tradeId} to closed_trades`);
          
        } catch (error) {
          logger.error(`Failed to move trade ${trade.tradeId}:`, error);
        }
      }
      
    } catch (error) {
      logger.error('Error in database cleanup:', error);
    }
  }
}

// Create singleton instance
const databaseCleanupService = new DatabaseCleanupService();

module.exports = databaseCleanupService;