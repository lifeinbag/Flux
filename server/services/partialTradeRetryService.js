// server/services/partialTradeRetryService.js
const { ActiveTrade, Broker, AccountSet } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
// We'll use direct broker execution instead of TradingService class
const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 30000
});

const mt4Client = axios.create({
  baseURL: process.env.MT4_API_URL,
  timeout: 30000,
  httpsAgent
});

const mt5Client = axios.create({
  baseURL: process.env.MT5_API_URL,
  timeout: 30000,
  httpsAgent
});

class PartialTradeRetryService {
  constructor() {
    this.activeRetries = new Map(); // Track active retry processes
    this.retryInterval = process.env.PARTIAL_TRADE_RETRY_INTERVAL || 10000; // 10 seconds default
    this.maxRetryAttempts = process.env.MAX_RETRY_ATTEMPTS || 50; // 50 attempts default
    // No need to instantiate TradingService - we'll use direct execution
  }

  async initialize() {
    logger.info('🔄 Initializing Partial Trade Retry Service');
    
    // Find all partial trades that need retry
    const partialTrades = await ActiveTrade.findAll({
      where: {
        status: 'PartiallyFilled',
        // Only retry trades that have one successful broker but missing the other
        [Op.or]: [
          { broker1Ticket: { [Op.ne]: null }, broker2Ticket: null },
          { broker1Ticket: null, broker2Ticket: { [Op.ne]: null } }
        ]
      },
      include: [
        {
          model: AccountSet,
          include: [{
            model: Broker,
            as: 'brokers'
          }]
        }
      ]
    });

    logger.info(`📊 Found ${partialTrades.length} partial trades requiring retry`);

    // Start retry process for each partial trade
    for (const trade of partialTrades) {
      await this.startRetryProcess(trade);
    }
  }

  async startRetryProcess(partialTrade) {
    const tradeId = partialTrade.id;
    
    // Prevent duplicate retry processes
    if (this.activeRetries.has(tradeId)) {
      logger.warn(`⚠ Retry process already active for trade ${tradeId}`);
      return;
    }

    logger.info(`🔄 Starting retry process for partial trade ${tradeId}`);

    const retryData = {
      tradeId,
      attempts: 0,
      startTime: Date.now(),
      lastAttempt: null
    };

    this.activeRetries.set(tradeId, retryData);

    // Start retry interval
    const intervalId = setInterval(async () => {
      try {
        await this.attemptPartialTradeCompletion(partialTrade);
      } catch (error) {
        logger.error(`❌ Retry attempt failed for trade ${tradeId}:`, error.message);
        
        retryData.attempts++;
        retryData.lastAttempt = Date.now();

        // Check if max attempts reached
        if (retryData.attempts >= this.maxRetryAttempts) {
          logger.error(`🚫 Max retry attempts (${this.maxRetryAttempts}) reached for trade ${tradeId}`);
          clearInterval(intervalId);
          this.activeRetries.delete(tradeId);
        }
      }
    }, this.retryInterval);

    // Store interval ID for cleanup
    retryData.intervalId = intervalId;
  }

  async attemptPartialTradeCompletion(partialTrade) {
    const tradeId = partialTrade.id;
    
    // Reload trade data to get latest state
    const currentTrade = await ActiveTrade.findByPk(tradeId, {
      include: [
        {
          model: AccountSet,
          include: [{
            model: Broker,
            as: 'brokers'
          }]
        }
      ]
    });

    if (!currentTrade) {
      logger.warn(`⚠ Trade ${tradeId} no longer exists, stopping retry`);
      this.stopRetryProcess(tradeId);
      return;
    }

    // Check if trade is already complete
    if (currentTrade.status === 'Active' && currentTrade.broker1Ticket && currentTrade.broker2Ticket) {
      logger.success(`✅ Trade ${tradeId} already completed, stopping retry`);
      this.stopRetryProcess(tradeId);
      return;
    }

    const accountSet = currentTrade.AccountSet;
    const brokers = accountSet.brokers.sort((a, b) => a.position - b.position);
    const broker1 = brokers[0]; // Future broker
    const broker2 = brokers[1]; // Spot broker

    // Determine which broker needs the retry
    let missingBroker, missingDirection, missingSymbol, successfulTicket;
    
    if (currentTrade.broker1Ticket && !currentTrade.broker2Ticket) {
      // Broker2 failed, retry broker2
      missingBroker = broker2;
      missingDirection = this.getReverseDirection(currentTrade.broker1Direction);
      missingSymbol = accountSet.spotSymbol;
      successfulTicket = currentTrade.broker1Ticket;
      logger.info(`🎯 Retrying broker2 (${broker2.terminal}) for trade ${tradeId}, successful broker1 ticket: ${successfulTicket}`);
    } else if (currentTrade.broker2Ticket && !currentTrade.broker1Ticket) {
      // Broker1 failed, retry broker1  
      missingBroker = broker1;
      missingDirection = currentTrade.broker2Direction === 'Buy' ? 'Sell' : 'Buy';
      missingSymbol = accountSet.futureSymbol;
      successfulTicket = currentTrade.broker2Ticket;
      logger.info(`🎯 Retrying broker1 (${broker1.terminal}) for trade ${tradeId}, successful broker2 ticket: ${successfulTicket}`);
    } else {
      logger.warn(`⚠ Invalid partial trade state for ${tradeId}`);
      return;
    }

    // Prepare order parameters with ticket mapping
    const orderParams = {
      symbol: missingSymbol,
      operation: missingDirection,
      volume: currentTrade.broker1Volume || currentTrade.broker2Volume || 0.01,
      comment: `FluxNetwork Retry - Mapped:${successfulTicket}`
    };

    logger.info(`📤 Attempting retry order for trade ${tradeId}:`, {
      broker: missingBroker.terminal,
      brokerId: missingBroker.id,
      symbol: missingSymbol,
      direction: missingDirection,
      mappedTicket: successfulTicket
    });

    // Execute the retry order directly
    const retryResult = await this.executeOrderOnBroker(missingBroker, orderParams);

    if (retryResult.success && retryResult.ticket) {
      logger.success(`✅ Retry successful for trade ${tradeId}! New ticket: ${retryResult.ticket}`);

      // Update the partial trade to complete it
      const updateData = {
        status: 'Active' // Change from PartiallyFilled to Active
      };

      if (currentTrade.broker1Ticket && !currentTrade.broker2Ticket) {
        // Update broker2 fields
        updateData.broker2Id = missingBroker.id;
        updateData.broker2Ticket = retryResult.ticket;
        updateData.broker2Symbol = missingSymbol;
        updateData.broker2Direction = missingDirection;
        updateData.broker2Volume = orderParams.volume;
        updateData.broker2Latency = retryResult.latency;
        updateData.comment = `${currentTrade.comment} - COMPLETED via retry`;
      } else {
        // Update broker1 fields
        updateData.broker1Id = missingBroker.id;
        updateData.broker1Ticket = retryResult.ticket;
        updateData.broker1Symbol = missingSymbol;
        updateData.broker1Direction = missingDirection;
        updateData.broker1Volume = orderParams.volume;
        updateData.broker1Latency = retryResult.latency;
        updateData.comment = `${currentTrade.comment} - COMPLETED via retry`;
      }

      await currentTrade.update(updateData);
      
      logger.success(`🎉 Partial trade ${tradeId} completed successfully! Both brokers now active.`);
      
      // Stop retry process
      this.stopRetryProcess(tradeId);

    } else {
      const retryData = this.activeRetries.get(tradeId);
      retryData.attempts++;
      retryData.lastAttempt = Date.now();
      
      logger.warn(`⚠ Retry attempt ${retryData.attempts} failed for trade ${tradeId}: ${retryResult.error}`);
      
      // Don't throw error - let interval continue
    }
  }

  stopRetryProcess(tradeId) {
    const retryData = this.activeRetries.get(tradeId);
    if (retryData && retryData.intervalId) {
      clearInterval(retryData.intervalId);
      this.activeRetries.delete(tradeId);
      logger.info(`🛑 Stopped retry process for trade ${tradeId}`);
    }
  }

  getReverseDirection(direction) {
    return direction === 'Buy' ? 'Sell' : 'Buy';
  }

  // Execute order on broker (simplified version)
  async executeOrderOnBroker(broker, orderParams) {
    const startTime = Date.now();
    
    try {
      const client = broker.terminal === 'MT5' ? mt5Client : mt4Client;
      const { TokenManager } = require('../token-manager');
      
      // Get valid token
      const token = await TokenManager.getToken(
        broker.terminal === 'MT5',
        broker.server,
        broker.accountNumber,
        broker.password,
        broker.id
      );
      
      const fullParams = {
        id: token,
        ...orderParams,
        comment: orderParams.comment || 'FluxNetwork Retry'
      };

      // Add terminal-specific parameters
      if (broker.terminal === 'MT5') {
        fullParams.slippage = 100;
        delete fullParams.price;
      } else if (broker.terminal === 'MT4') {
        fullParams.price = 0;
        delete fullParams.slippage;
      }

      logger.info(`🔄 Retry order execution on ${broker.terminal}:`, fullParams);
      
      const response = await client.get('/OrderSend', { params: fullParams });
      const latency = Date.now() - startTime;

      if (response.data && response.data.ticket) {
        return {
          success: true,
          ticket: response.data.ticket,
          latency,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.data?.error || 'Unknown error',
          latency,
          data: response.data
        };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        latency
      };
    }
  }

  // Method to manually trigger retry for a specific trade
  async retrySpecificTrade(tradeId) {
    const trade = await ActiveTrade.findByPk(tradeId, {
      include: [
        {
          model: AccountSet,
          include: [{
            model: Broker,
            as: 'brokers'
          }]
        }
      ]
    });

    if (!trade) {
      throw new Error(`Trade ${tradeId} not found`);
    }

    if (trade.status !== 'PartiallyFilled') {
      throw new Error(`Trade ${tradeId} is not in PartiallyFilled status`);
    }

    await this.startRetryProcess(trade);
  }

  // Get retry statistics
  getRetryStatistics() {
    const stats = {
      activeRetries: this.activeRetries.size,
      retryProcesses: []
    };

    for (const [tradeId, retryData] of this.activeRetries.entries()) {
      stats.retryProcesses.push({
        tradeId,
        attempts: retryData.attempts,
        startTime: retryData.startTime,
        lastAttempt: retryData.lastAttempt,
        runtime: Date.now() - retryData.startTime
      });
    }

    return stats;
  }
}

module.exports = new PartialTradeRetryService();