const axios = require('axios');
const https = require('https');
// Removed fs - not needed for file logging
const { ActiveTrade, ClosedTrade, PendingOrder, AccountSet, Broker, sequelize } = require('../models');
const latencyMonitor = require('./latencyMonitor');
const unifiedQuoteService = require('./unifiedQuoteService');
const logger = require('../utils/logger');
const { TokenManager } = require('../token-manager');

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

class TradingService {
  
  // Get valid token for broker
  async getValidBrokerToken(broker, forceRefresh = false) {
    const now = Date.now();
    const tokenValid = broker.token && 
                      broker.tokenExpiresAt && 
                      new Date(broker.tokenExpiresAt).getTime() > now;
    
    if (tokenValid && !forceRefresh) {
      return broker.token;
    }
    
    const token = await TokenManager.getToken(
      broker.terminal === 'MT5',
      broker.server,
      broker.accountNumber,
      broker.password,
      broker.id
    );
    
    broker.token = token;
    broker.tokenExpiresAt = new Date(Date.now() + 22 * 60 * 60 * 1000);
    await broker.save();
    
    return token;
  }

  // Get reverse direction for broker 2
  getReverseDirection(direction) {
    return direction === 'Buy' ? 'Sell' : 'Buy';
  }

  // Execute order on a broker and measure latency
  async executeOrderOnBroker(broker, orderParams) {
    const startTime = Date.now();
    
    try {
      const client = broker.terminal === 'MT5' ? mt5Client : mt4Client;
      const token = await this.getValidBrokerToken(broker);
      
      const fullParams = {
        id: token,
        ...orderParams,
        comment: orderParams.comment || 'FluxNetwork'
      };

      // Add terminal-specific parameters
      if (broker.terminal === 'MT5') {
        fullParams.slippage = 100; // Reasonable slippage value
        // Remove price for MT5
        delete fullParams.price;
      } else if (broker.terminal === 'MT4') {
        fullParams.price = 0;
        // Remove slippage for MT4
        delete fullParams.slippage;
      }

      // Log order execution details
      console.log('Order execution details:', {
        timestamp: new Date().toISOString(),
        brokerType: broker.terminal,
        brokerId: broker.id,
        apiUrl: client.defaults.baseURL,
        parameters: fullParams
      });

      console.log(`Executing order on ${broker.terminal} broker (ID: ${broker.id})`);
      console.log('Order parameters:', JSON.stringify(fullParams, null, 2));
      console.log('API URL:', client.defaults.baseURL);

      const response = await client.get('/OrderSend', { params: fullParams });
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Record latency
      latencyMonitor.addLatencyRecord(broker.id, 'orderSend', latency);
      
      // Extract ticket number from response
      let ticket = null;
      if (response.data) {
        // Try different possible response formats
        ticket = response.data.ticket || 
                response.data.order || 
                response.data.orderId ||
                response.data.result ||
                response.data;
        
        // If it's still an object, try to extract numeric value
        if (typeof ticket === 'object') {
          ticket = Object.values(ticket).find(val => 
            typeof val === 'string' || typeof val === 'number'
          );
        }
      }
      
      return {
        success: true,
        ticket: ticket ? String(ticket) : null,
        latency,
        response: response.data
      };
      
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // Record latency even for failed orders
      latencyMonitor.addLatencyRecord(broker.id, 'orderSend', latency);
      
      // Log error details
      console.error('Order execution error details:', {
        timestamp: new Date().toISOString(),
        brokerType: broker.terminal,
        brokerId: broker.id,
        error: error.message,
        errorResponse: error.response?.data,
        errorStatus: error.response?.status
      });

      console.error(`Order execution failed on ${broker.terminal} broker (ID: ${broker.id})`);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      return {
        success: false,
        error: error.message,
        latency,
        response: error.response?.data
      };
    }
  }

  // Execute trade at current premium
  async executeAtCurrentPremium(params) {
    const {
      accountSetId,
      userId,
      direction,
      volume,
      takeProfit,
      takeProfitMode = 'None',
      stopLoss,
      scalpingMode = false,
      comment = 'FluxNetwork Trade'
    } = params;

    try {
      // Get account set with brokers and symbols
      const accountSet = await AccountSet.findByPk(accountSetId, {
        include: [{
          model: Broker,
          as: 'brokers',
          order: [['position', 'ASC']]
        }]
      });

      if (!accountSet || !accountSet.brokers || accountSet.brokers.length < 2) {
        throw new Error('Account set not found or missing brokers');
      }

      if (!accountSet.symbolsLocked || !accountSet.futureSymbol || !accountSet.spotSymbol) {
        throw new Error('Account set symbols not locked or missing');
      }

      const broker1 = accountSet.brokers.find(b => b.position === 1);
      const broker2 = accountSet.brokers.find(b => b.position === 2);

      if (!broker1 || !broker2) {
        throw new Error('Missing required broker positions');
      }

      // Check if symbols are properly set
      if (!accountSet.futureSymbol || !accountSet.spotSymbol) {
        throw new Error(`Missing symbols - Future: ${accountSet.futureSymbol}, Spot: ${accountSet.spotSymbol}`);
      }

      // ✅ FIX: Use unified quote service for consistent quotes
      logger.info(`🎯 Trade Execution: Getting quotes via UnifiedQuoteService for ${accountSet.futureSymbol}/${accountSet.spotSymbol}`);
      
      const quotes = await unifiedQuoteService.getQuotes(
        broker1, accountSet.futureSymbol,
        broker2, accountSet.spotSymbol
      );

      if (!quotes || quotes.length !== 2) {
        throw new Error('Unable to get quotes from unified quote service');
      }

      const [futureQuote, spotQuote] = quotes;
      
      logger.info(`📊 Execution quotes: Future=${futureQuote.bid}/${futureQuote.ask} (${futureQuote.source}), Spot=${spotQuote.bid}/${spotQuote.ask} (${spotQuote.source})`);

      // ✅ FIX: Validate quotes from unified service
      if (!futureQuote || !spotQuote || !futureQuote.bid || !futureQuote.ask || !spotQuote.bid || !spotQuote.ask) {
        logger.error(`❌ Invalid quotes from unified service: Future=${JSON.stringify(futureQuote)}, Spot=${JSON.stringify(spotQuote)}`);
        throw new Error('Invalid quotes received from unified quote service');
      }

      // Calculate current premium based on direction
      let currentPremium;
      if (direction === 'Buy') {
        currentPremium = (futureQuote.ask || 0) - (spotQuote.bid || 0);
      } else {
        currentPremium = (futureQuote.bid || 0) - (spotQuote.ask || 0);
      }

      logger.info(`📊 Execution Premium: ${currentPremium} (Direction: ${direction})`);

      return await this.continueTradeExecution(
        broker1, broker2, accountSet, direction, volume, comment, 
        futureQuote, spotQuote, currentPremium, 
        takeProfit, takeProfitMode, stopLoss, scalpingMode, userId, accountSetId
      );

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Execute trade at target premium (creates pending order)
  async executeAtTargetPremium(params) {
    const {
      accountSetId,
      userId,
      direction,
      volume,
      targetPremium,
      takeProfit,
      takeProfitMode = 'None',
      stopLoss,
      scalpingMode = false,
      comment = 'FluxNetwork Target Order'
    } = params;

    try {
      // Get account set with brokers
      const accountSet = await AccountSet.findByPk(accountSetId, {
        include: [{
          model: Broker,
          as: 'brokers',
          order: [['position', 'ASC']]
        }]
      });

      if (!accountSet || !accountSet.brokers || accountSet.brokers.length < 2) {
        throw new Error('Account set not found or missing brokers');
      }

      if (!accountSet.symbolsLocked || !accountSet.futureSymbol || !accountSet.spotSymbol) {
        throw new Error('Account set symbols not locked or missing');
      }

      const broker1 = accountSet.brokers.find(b => b.position === 1);
      const broker2 = accountSet.brokers.find(b => b.position === 2);

      if (!broker1 || !broker2) {
        throw new Error('Missing required broker positions');
      }

      // Create pending order
      const pendingOrder = await PendingOrder.create({
        accountSetId,
        userId,
        broker1Id: broker1.id,
        broker2Id: broker2.id,
        broker1Symbol: accountSet.futureSymbol,
        broker2Symbol: accountSet.spotSymbol,
        direction,
        volume,
        targetPremium,
        takeProfit,
        takeProfitMode,
        stopLoss,
        scalpingMode,
        comment,
        status: 'Pending'
      });

      return {
        success: true,
        pendingOrder,
        message: `Pending order created. Will execute when ${direction.toLowerCase()} premium reaches ${targetPremium}`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get current quotes for both brokers
  async getCurrentQuotes(broker1, symbol1, broker2, symbol2, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        console.log(`QUOTE REQUEST (attempt ${attempt}): Getting quotes for ${symbol1} (${broker1.terminal}) and ${symbol2} (${broker2.terminal})`);
        
        const [token1, token2] = await Promise.all([
          this.getValidBrokerToken(broker1),
          this.getValidBrokerToken(broker2)
        ]);

        const client1 = broker1.terminal === 'MT5' ? mt5Client : mt4Client;
        const client2 = broker2.terminal === 'MT5' ? mt5Client : mt4Client;

        const [response1, response2] = await Promise.all([
          client1.get('/GetQuote', { params: { id: token1, symbol: symbol1 }, timeout: 30000 }),
          client2.get('/GetQuote', { params: { id: token2, symbol: symbol2 }, timeout: 30000 })
        ]);

        const quote1 = response1.data;
        const quote2 = response2.data;

        console.log(`QUOTES SUCCESS: ${symbol1}=${JSON.stringify(quote1)}, ${symbol2}=${JSON.stringify(quote2)}`);

        // Validate quotes
        if (!quote1 || !quote1.bid || !quote1.ask) {
          throw new Error(`Invalid quote data for ${symbol1}: ${JSON.stringify(quote1)}`);
        }
        if (!quote2 || !quote2.bid || !quote2.ask) {
          throw new Error(`Invalid quote data for ${symbol2}: ${JSON.stringify(quote2)}`);
        }

        return [
          {
            bid: parseFloat(quote1.bid),
            ask: parseFloat(quote1.ask),
            symbol: symbol1
          },
          {
            bid: parseFloat(quote2.bid),
            ask: parseFloat(quote2.ask),
            symbol: symbol2
          }
        ];
      } catch (error) {
        console.log(`QUOTE ERROR (attempt ${attempt}): ${error.message}`);
        
        // If this is the last attempt, return null
        if (attempt > maxRetries) {
          console.error('Error getting current quotes after retries:', error.message);
          return [null, null];
        }
        
        // Wait before retrying (1 second, increasing delay)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // Close active trade
  async closeTrade(tradeId, userId, reason = 'Manual') {
    console.log(`🔄 Starting trade closure for ${tradeId}`);
    
    // ✅ FIX: Use database transaction to prevent partial closures
    const transaction = await sequelize.transaction();
    
    try {
      const activeTrade = await ActiveTrade.findOne({
        where: { tradeId, userId },
        include: [
          { model: Broker, as: 'broker1' },
          { model: Broker, as: 'broker2' }
        ],
        transaction
      });

      if (!activeTrade) {
        throw new Error('Active trade not found');
      }

      logger.info(`📋 Found trade: Broker1 ticket ${activeTrade.broker1Ticket}, Broker2 ticket ${activeTrade.broker2Ticket}`);

      // ✅ FIX: Close orders sequentially with better error handling
      let broker1Result = { success: false, error: 'Not executed', profit: 0 };
      let broker2Result = { success: false, error: 'Not executed', profit: 0 };
      
      // Close broker1 order
      if (activeTrade.broker1Ticket) {
        logger.info(`🔄 Closing Broker1 order ${activeTrade.broker1Ticket}...`);
        broker1Result = await this.closeOrderOnBroker(activeTrade.broker1, activeTrade.broker1Ticket);
        logger.info(`📊 Broker1 result:`, broker1Result);
      }
      
      // Close broker2 order
      if (activeTrade.broker2Ticket) {
        logger.info(`🔄 Closing Broker2 order ${activeTrade.broker2Ticket}...`);
        broker2Result = await this.closeOrderOnBroker(activeTrade.broker2, activeTrade.broker2Ticket);
        logger.info(`📊 Broker2 result:`, broker2Result);
      }

      const closeResults = [broker1Result, broker2Result];
      const successCount = closeResults.filter(r => r.success).length;
      
      logger.info(`✅ Closed ${successCount}/2 positions successfully`);

      // ✅ FIX: Get quotes using unified service for consistency
      logger.info(`🎯 Trade Closure: Getting quotes via UnifiedQuoteService for ${activeTrade.broker1Symbol}/${activeTrade.broker2Symbol}`);
      const quotes = await unifiedQuoteService.getQuotes(
        activeTrade.broker1, activeTrade.broker1Symbol,
        activeTrade.broker2, activeTrade.broker2Symbol
      );
      
      let futureQuote = null;
      let spotQuote = null;
      
      if (quotes && quotes.length === 2) {
        [futureQuote, spotQuote] = quotes;
      }

      let closePremium = 0;
      if (futureQuote && spotQuote) {
        if (activeTrade.broker1Direction === 'Buy') {
          closePremium = (futureQuote.bid || 0) - (spotQuote.ask || 0);
        } else {
          closePremium = (futureQuote.ask || 0) - (spotQuote.bid || 0);
        }
      }

      // Calculate trade duration
      const tradeDurationMinutes = Math.floor(
        (Date.now() - new Date(activeTrade.createdAt).getTime()) / (1000 * 60)
      );

      // ✅ FIX: Create closed trade record within transaction
      const closedTrade = await ClosedTrade.create({
        tradeId: activeTrade.tradeId,
        accountSetId: activeTrade.accountSetId,
        userId: activeTrade.userId,
        
        broker1Id: activeTrade.broker1Id,
        broker1Ticket: activeTrade.broker1Ticket,
        broker1Symbol: activeTrade.broker1Symbol,
        broker1Direction: activeTrade.broker1Direction,
        broker1Volume: activeTrade.broker1Volume,
        broker1OpenPrice: activeTrade.broker1OpenPrice,
        broker1ClosePrice: activeTrade.broker1Direction === 'Buy' ? futureQuote?.bid : futureQuote?.ask,
        broker1CloseTime: new Date(),
        broker1OpenTime: activeTrade.broker1OpenTime,
        broker1Profit: closeResults[0].profit || 0,
        
        broker2Id: activeTrade.broker2Id,
        broker2Ticket: activeTrade.broker2Ticket,
        broker2Symbol: activeTrade.broker2Symbol,
        broker2Direction: activeTrade.broker2Direction,
        broker2Volume: activeTrade.broker2Volume,
        broker2OpenPrice: activeTrade.broker2OpenPrice,
        broker2ClosePrice: activeTrade.broker2Direction === 'Buy' ? spotQuote?.bid : spotQuote?.ask,
        broker2CloseTime: new Date(),
        broker2OpenTime: activeTrade.broker2OpenTime,
        broker2Profit: closeResults[1].profit || 0,
        
        executionPremium: activeTrade.executionPremium,
        closePremium,
        totalProfit: (closeResults[0].profit || 0) + (closeResults[1].profit || 0),
        takeProfit: activeTrade.takeProfit,
        takeProfitMode: activeTrade.takeProfitMode || 'None',
        stopLoss: activeTrade.stopLoss,
        closeReason: reason,
        tradeDurationMinutes,
        
        broker1Latency: activeTrade.broker1Latency,
        broker2Latency: activeTrade.broker2Latency,
        comment: activeTrade.comment,
        scalpingMode: activeTrade.scalpingMode
      }, { transaction });

      // ✅ FIX: Remove from active trades within transaction
      await activeTrade.destroy({ transaction });
      
      // ✅ FIX: Commit transaction
      await transaction.commit();
      
      console.log(`✅ Trade ${tradeId} closed successfully and moved to closed trades`);

      return {
        success: true,
        closedTrade,
        closeResults,
        message: `Successfully closed ${successCount}/2 positions`
      };

    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Failed to close trade ${tradeId}:`, error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Close order on a specific broker
  async closeOrderOnBroker(broker, ticket) {
    try {
      const client = broker.terminal === 'MT5' ? mt5Client : mt4Client;
      const token = await this.getValidBrokerToken(broker);

      const response = await client.get('/OrderClose', {
        params: { id: token, ticket }
      });

      return {
        success: true,
        profit: response.data?.profit || 0,
        response: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        profit: 0
      };
    }
  }

  // Helper method to continue trade execution after quotes are obtained
  async continueTradeExecution(broker1, broker2, accountSet, direction, volume, comment, 
                              futureQuote, spotQuote, currentPremium, 
                              takeProfit, takeProfitMode, stopLoss, scalpingMode, userId, accountSetId) {
    // Prepare order parameters for both brokers
    const broker1OrderParams = {
      symbol: accountSet.futureSymbol,
      operation: direction,
      volume: volume,
      comment: comment
    };

    const broker2OrderParams = {
      symbol: accountSet.spotSymbol,
      operation: this.getReverseDirection(direction),
      volume: volume,
      comment: comment
    };

    // Execute broker1 order first
    const broker1Result = await this.executeOrderOnBroker(broker1, broker1OrderParams);
    
    // If broker1 successful, update broker2 comment with broker1 ticket
    if (broker1Result.success && broker1Result.ticket) {
      broker2OrderParams.comment = `${comment} - B1:${broker1Result.ticket}`;
    }
    
    // Execute broker2 order
    const broker2Result = await this.executeOrderOnBroker(broker2, broker2OrderParams);

    // Check if both orders were successful
    if (!broker1Result.success || !broker2Result.success) {
      console.log('⚠️ One or both brokers failed:', {
        broker1Success: broker1Result.success,
        broker1Ticket: broker1Result.ticket,
        broker1Error: broker1Result.error,
        broker2Success: broker2Result.success,
        broker2Ticket: broker2Result.ticket,
        broker2Error: broker2Result.error
      });
      
      // NEW LOGIC: Don't close successful trades, just create partial trade record
      if (broker1Result.success && broker1Result.ticket && !broker2Result.success) {
        console.log('✅ Broker1 succeeded but Broker2 failed - keeping Broker1 trade as partial trade');
        
        // Create a partial ActiveTrade record for the successful broker1 trade
        const transaction1 = await sequelize.transaction();
        try {
          const partialTrade = await ActiveTrade.create({
            accountSetId,
            userId,
            broker1Id: broker1.id,
            broker1Ticket: broker1Result.ticket,
            broker1Symbol: accountSet.futureSymbol,
            broker1Direction: direction,
            broker1Volume: volume,
            broker1OpenPrice: direction === 'Buy' ? futureQuote.ask : futureQuote.bid,
            broker1Latency: broker1Result.latency,
            
            // Broker2 fields are null/empty since it failed
            broker2Id: null,
            broker2Ticket: null,
            broker2Symbol: null,
            broker2Direction: null,
            broker2Volume: null,
            broker2OpenPrice: null,
            broker2Latency: null,
            
            executionPremium: currentPremium,
            takeProfit,
            takeProfitMode: takeProfitMode || 'None',
            stopLoss,
            scalpingMode,
            comment: `${comment} - PARTIAL: Broker2 failed (${broker2Result.error})`,
            status: 'PartiallyFilled' // Status for partial trades
          }, { transaction: transaction1 });
          
          await transaction1.commit();
          
          return {
            success: true,
            trade: partialTrade,
            executionDetails: {
              broker1: broker1Result,
              broker2: broker2Result,
              premium: currentPremium,
              futureQuote,
              spotQuote,
              warning: 'Partial execution - only Broker1 succeeded'
            }
          };
        } catch (transactionError) {
          await transaction1.rollback();
          console.error('❌ Failed to create partial trade for Broker1:', transactionError);
          throw new Error(`Failed to save partial trade data: ${transactionError.message}`);
        }
      }
      
      if (broker2Result.success && broker2Result.ticket && !broker1Result.success) {
        console.log('✅ Broker2 succeeded but Broker1 failed - keeping Broker2 trade as partial trade');
        
        // Create a partial ActiveTrade record for the successful broker2 trade
        const transaction2 = await sequelize.transaction();
        try {
          const partialTrade = await ActiveTrade.create({
            accountSetId,
            userId,
            
            // Broker1 fields are null/empty since it failed
            broker1Id: null,
            broker1Ticket: null,
            broker1Symbol: null,
            broker1Direction: null,
            broker1Volume: null,
            broker1OpenPrice: null,
            broker1Latency: null,
            
            broker2Id: broker2.id,
            broker2Ticket: broker2Result.ticket,
            broker2Symbol: accountSet.spotSymbol,
            broker2Direction: this.getReverseDirection(direction),
            broker2Volume: volume,
            broker2OpenPrice: this.getReverseDirection(direction) === 'Buy' ? spotQuote.ask : spotQuote.bid,
            broker2Latency: broker2Result.latency,
            
            executionPremium: currentPremium,
            takeProfit,
            takeProfitMode: takeProfitMode || 'None',
            stopLoss,
            scalpingMode,
            comment: `${comment} - PARTIAL: Broker1 failed (${broker1Result.error})`,
            status: 'PartiallyFilled' // Status for partial trades
          }, { transaction: transaction2 });
          
          await transaction2.commit();
          
          return {
            success: true,
            trade: partialTrade,
            executionDetails: {
              broker1: broker1Result,
              broker2: broker2Result,
              premium: currentPremium,
              futureQuote,
              spotQuote,
              warning: 'Partial execution - only Broker2 succeeded'
            }
          };
        } catch (transactionError) {
          await transaction2.rollback();
          console.error('❌ Failed to create partial trade for Broker2:', transactionError);
          throw new Error(`Failed to save partial trade data: ${transactionError.message}`);
        }
      }

      // Both failed - throw error
      throw new Error(
        `Order execution failed. Broker1: ${broker1Result.success ? 'OK' : broker1Result.error}, ` +
        `Broker2: ${broker2Result.success ? 'OK' : broker2Result.error}`
      );
    }

    if (!broker1Result.ticket || !broker2Result.ticket) {
      throw new Error('Orders executed but ticket numbers not received');
    }
    
    logger.success('✅ Both brokers executed successfully, creating ActiveTrade record');
    
    // ✅ FIX: Use database transaction to ensure data consistency
    const transaction = await sequelize.transaction();
    
    try {
      // Create ActiveTrade record within transaction
      const activeTrade = await ActiveTrade.create({
        accountSetId,
        userId,
        broker1Id: broker1.id,
        broker1Ticket: broker1Result.ticket,
        broker1Symbol: accountSet.futureSymbol,
        broker1Direction: direction,
        broker1Volume: volume,
        broker1OpenPrice: direction === 'Buy' ? futureQuote.ask : futureQuote.bid,
        broker1Latency: broker1Result.latency,
        
        broker2Id: broker2.id,
        broker2Ticket: broker2Result.ticket,
        broker2Symbol: accountSet.spotSymbol,
        broker2Direction: this.getReverseDirection(direction),
        broker2Volume: volume,
        broker2OpenPrice: this.getReverseDirection(direction) === 'Buy' ? spotQuote.ask : spotQuote.bid,
        broker2Latency: broker2Result.latency,
        
        executionPremium: currentPremium,
        takeProfit,
        takeProfitMode,
        stopLoss,
        scalpingMode,
        comment: comment,
        status: 'Active'
      }, { transaction });
      
      logger.success('✅ ActiveTrade created successfully:', {
        tradeId: activeTrade.tradeId,
        broker1Ticket: broker1Result.ticket,
        broker2Ticket: broker2Result.ticket,
        broker1Direction: direction,
        broker2Direction: this.getReverseDirection(direction),
        executionPremium: currentPremium,
        futureQuoteSource: futureQuote.source,
        spotQuoteSource: spotQuote.source
      });

      // Store latency data in AccountSet for persistence within transaction
      await accountSet.update({
        lastOrderBroker1Latency: broker1Result.latency,
        lastOrderBroker2Latency: broker2Result.latency,
        lastOrderTimestamp: new Date()
      }, { transaction });
      
      // ✅ FIX: Commit transaction to ensure immediate database consistency
      await transaction.commit();
      logger.success('✅ Database transaction committed successfully');
      
      return {
        success: true,
        trade: activeTrade,
        executionDetails: {
          broker1: broker1Result,
          broker2: broker2Result,
          premium: currentPremium,
          futureQuote,
          spotQuote
        }
      };
      
    } catch (transactionError) {
      await transaction.rollback();
      logger.error('❌ Database transaction failed, rolling back:', transactionError);
      throw new Error(`Failed to save trade data: ${transactionError.message}`);
    }
  }

  // Fetch all open orders for an account set
  async fetchAllOpenOrders(accountSetId) {
    try {
      console.log('🔍 Fetching all open orders for account set:', accountSetId);

      // Get account set with brokers
      const accountSet = await AccountSet.findByPk(accountSetId, {
        include: [{
          model: Broker,
          as: 'brokers',
          order: [['position', 'ASC']]
        }]
      });

      if (!accountSet || !accountSet.brokers || accountSet.brokers.length === 0) {
        console.log('⚠️ No account set or brokers found for:', accountSetId);
        return [];
      }

      const allOrders = [];

      // Fetch orders from each broker
      for (const broker of accountSet.brokers) {
        try {
          const client = broker.terminal === 'MT5' ? mt5Client : mt4Client;
          const token = await this.getValidBrokerToken(broker);

          console.log(`📡 Fetching orders from ${broker.terminal} broker ${broker.id}`);

          const response = await client.get('/OpenedOrders', {
            params: { id: token },
            timeout: 10000
          });

          let orders = response.data || [];
          
          // Ensure orders is an array
          if (!Array.isArray(orders)) {
            orders = orders ? [orders] : [];
          }

          // Enrich each order with broker information
          const enrichedOrders = orders.map(order => ({
            ...order,
            brokerId: broker.id,
            brokerName: broker.name,
            brokerPosition: broker.position,
            terminal: broker.terminal,
            accountNumber: broker.accountNumber,
            // Normalize common fields
            ticket: order.ticket || order.order || order.ticketNumber || order.id,
            symbol: order.symbol,
            type: order.type || order.orderType || order.cmd,
            lots: order.lots || order.volume || order.volumeSize,
            openPrice: order.openPrice || order.price || order.open_price,
            openTime: order.openTime || order.open_time || order.time,
            profit: order.profit || 0,
            swap: order.swap || 0,
            commission: order.commission || 0
          }));

          allOrders.push(...enrichedOrders);
          console.log(`✅ Found ${enrichedOrders.length} orders from broker ${broker.id}`);

        } catch (brokerError) {
          console.error(`❌ Error fetching orders from broker ${broker.id}:`, brokerError.message);
          // Continue with other brokers even if one fails
        }
      }

      console.log(`📦 Total orders found: ${allOrders.length}`);
      return allOrders;

    } catch (error) {
      console.error('❌ Error in fetchAllOpenOrders:', error.message);
      return [];
    }
  }
}

module.exports = new TradingService();