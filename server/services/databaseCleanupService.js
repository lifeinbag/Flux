const { ActiveTrade, ClosedTrade, sequelize } = require('../models');
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

      // Find trades that should be cleaned up:
      // 1. Trades marked as 'Closed' 
      // 2. Trades older than 24 hours (might be stale)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const staleTrades = await ActiveTrade.findAll({
        where: { 
          [sequelize.Op.or]: [
            { status: 'Closed' },
            { status: 'Error' },
            { 
              [sequelize.Op.and]: [
                { createdAt: { [sequelize.Op.lt]: oneDayAgo } },
                { status: 'Active' }
              ]
            }
          ]
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
              
              // Close details - determine reason based on status
              closeReason: trade.status === 'Closed' ? 'Cleanup - Already closed' : 
                          trade.status === 'Error' ? 'Cleanup - Error status' : 
                          'Cleanup - Stale trade (24h+)',
              totalProfit: 0 // Will be calculated separately if needed
            });

            logger.info(`Created closed trade record for trade: ${trade.tradeId}`);
          } else {
            logger.info(`Trade ${trade.tradeId} already exists in closed_trades, skipping creation`);
          }

          // Remove from active trades regardless of whether we created closed record
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

  // Enhanced cleanup that also checks for duplicates
  async performAdvancedCleanup() {
    try {
      logger.info('Performing advanced database cleanup...');

      // Also remove duplicate closed trades
      const duplicateClosed = await ClosedTrade.findAll({
        attributes: ['tradeId'],
        group: ['tradeId'],
        having: sequelize.fn('COUNT', sequelize.col('tradeId')) > 1
      });

      if (duplicateClosed.length > 0) {
        logger.info(`Found ${duplicateClosed.length} duplicate closed trades`);
        
        for (const duplicate of duplicateClosed) {
          const trades = await ClosedTrade.findAll({
            where: { tradeId: duplicate.tradeId },
            order: [['createdAt', 'DESC']]
          });
          
          // Keep the first (most recent), remove others
          for (let i = 1; i < trades.length; i++) {
            await trades[i].destroy();
            logger.info(`Removed duplicate closed trade: ${trades[i].id}`);
          }
        }
      }

      // Perform regular cleanup
      await this.performCleanup();
      
    } catch (error) {
      logger.error('Error in advanced cleanup:', error);
    }
  }

  // Manual cleanup trigger
  async triggerCleanup() {
    await this.performCleanup();
  }

  // Manual advanced cleanup trigger
  async triggerAdvancedCleanup() {
    await this.performAdvancedCleanup();
  }
}

// Create singleton instance
const databaseCleanupService = new DatabaseCleanupService();

module.exports = databaseCleanupService;