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
      logger.info('Performing database cleanup...');

      // Find trades in active_trades table that have been marked as closed
      const staleTrades = await ActiveTrade.findAll({
        where: { 
          status: 'Closed'
        }
      });

      if (staleTrades.length === 0) {
        logger.info('No stale trades found in cleanup');
        return;
      }

      logger.info(`Found ${staleTrades.length} stale trades to clean up`);

      let cleanedCount = 0;
      for (const trade of staleTrades) {
        try {
          // Check if this trade already exists in closed_trades
          const existingClosedTrade = await ClosedTrade.findOne({
            where: { tradeId: trade.tradeId }
          });

          if (!existingClosedTrade) {
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
              closePremium: trade.executionPremium, // Use execution premium as close premium if not available
              takeProfit: trade.takeProfit,
              stopLoss: trade.stopLoss,
              broker1Latency: trade.broker1Latency,
              broker2Latency: trade.broker2Latency,
              comment: trade.comment,
              scalpingMode: trade.scalpingMode,
              
              // Close details
              closeReason: 'Cleanup - Auto closed',
              totalProfit: 0 // Will be calculated separately if needed
            });
          }

          // Remove from active trades
          await trade.destroy();
          cleanedCount++;
          
          logger.info(`Cleaned up stale trade: ${trade.tradeId}`);
        } catch (error) {
          logger.error(`Failed to clean up trade ${trade.tradeId}:`, error);
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Database cleanup completed: ${cleanedCount} stale trades cleaned`);
      }
    } catch (error) {
      logger.error('Error in database cleanup:', error);
    }
  }

  // Manual cleanup trigger
  async triggerCleanup() {
    await this.performCleanup();
  }
}

// Create singleton instance
const databaseCleanupService = new DatabaseCleanupService();

module.exports = databaseCleanupService;