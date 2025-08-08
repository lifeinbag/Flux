const axios = require('axios');
const https = require('https');
const fs = require('fs');
const { ActiveTrade, ClosedTrade, PendingOrder, AccountSet, Broker } = require('../models');
const latencyMonitor = require('./latencyMonitor');
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
        fullParams.slippage = 10000000000;
        // Remove price for MT5
        delete fullParams.price;
      } else if (broker.terminal === 'MT4') {
        fullParams.price = 0;
        // Remove slippage for MT4
        delete fullParams.slippage;
      }

      // Log to separate order execution file
      const orderLogData = {
        timestamp: new Date().toISOString(),
        brokerType: broker.terminal,
        brokerId: broker.id,
        apiUrl: client.defaults.baseURL,
        parameters: fullParams
      };
      
      fs.appendFileSync('./logs/order-execution.log', 
        JSON.stringify(orderLogData, null, 2) + '\n---\n'
      );

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
      
      // Log error to order execution file
      const errorLogData = {
        timestamp: new Date().toISOString(),
        brokerType: broker.terminal,
        brokerId: broker.id,
        error: error.message,
        errorResponse: error.response?.data,
        errorStatus: error.response?.status
      };
      
      fs.appendFileSync('./logs/order-execution.log', 
        'ERROR: ' + JSON.stringify(errorLogData, null, 2) + '\n---\n'
      );

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

      // Get current quotes for premium calculation
      const [futureQuote, spotQuote] = await this.getCurrentQuotes(
        broker1, accountSet.futureSymbol,
        broker2, accountSet.spotSymbol
      );

      if (!futureQuote || !spotQuote) {
        // Try one more time with individual requests instead of parallel
        try {
          fs.appendFileSync('./logs/order-execution.log', 
            `FALLBACK: Trying individual quote requests\n`
          );
          
          const token1 = await this.getValidBrokerToken(broker1);
          const token2 = await this.getValidBrokerToken(broker2);
          const client1 = broker1.terminal === 'MT5' ? mt5Client : mt4Client;
          const client2 = broker2.terminal === 'MT5' ? mt5Client : mt4Client;
          
          // Try sequentially instead of parallel
          const response1 = await client1.get('/GetQuote', { 
            params: { id: token1, symbol: accountSet.futureSymbol }, 
            timeout: 30000 
          });
          
          const response2 = await client2.get('/GetQuote', { 
            params: { id: token2, symbol: accountSet.spotSymbol }, 
            timeout: 30000 
          });
          
          const fallbackQuote1 = response1.data;
          const fallbackQuote2 = response2.data;
          
          if (fallbackQuote1?.bid && fallbackQuote1?.ask && fallbackQuote2?.bid && fallbackQuote2?.ask) {
            fs.appendFileSync('./logs/order-execution.log', 
              `FALLBACK SUCCESS: Got quotes individually\n`
            );
            
            const futureQuoteFallback = {
              bid: parseFloat(fallbackQuote1.bid),
              ask: parseFloat(fallbackQuote1.ask),
              symbol: accountSet.futureSymbol
            };
            
            const spotQuoteFallback = {
              bid: parseFloat(fallbackQuote2.bid),
              ask: parseFloat(fallbackQuote2.ask),
              symbol: accountSet.spotSymbol
            };
            
            // Continue with fallback quotes
            const currentPremiumFallback = direction === 'Buy' ? 
              (futureQuoteFallback.ask || 0) - (spotQuoteFallback.bid || 0) :
              (futureQuoteFallback.bid || 0) - (spotQuoteFallback.ask || 0);
            
            return await this.continueTradeExecution(
              broker1, broker2, accountSet, direction, volume, comment, 
              futureQuoteFallback, spotQuoteFallback, currentPremiumFallback, 
              takeProfit, stopLoss, scalpingMode, userId, accountSetId
            );
          }
        } catch (fallbackError) {
          fs.appendFileSync('./logs/order-execution.log', 
            `FALLBACK FAILED: ${fallbackError.message}\n`
          );
        }
        
        throw new Error('Unable to get current quotes for premium calculation after all attempts');
      }

      // Calculate current premium based on direction
      let currentPremium;
      if (direction === 'Buy') {
        currentPremium = (futureQuote.ask || 0) - (spotQuote.bid || 0);
      } else {
        currentPremium = (futureQuote.bid || 0) - (spotQuote.ask || 0);
      }

      return await this.continueTradeExecution(
        broker1, broker2, accountSet, direction, volume, comment, 
        futureQuote, spotQuote, currentPremium, 
        takeProfit, stopLoss, scalpingMode, userId, accountSetId
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
        // Log quote request to file
        fs.appendFileSync('./logs/order-execution.log', 
          `QUOTE REQUEST (attempt ${attempt}): Getting quotes for ${symbol1} (${broker1.terminal}) and ${symbol2} (${broker2.terminal})\n`
        );
        
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

        fs.appendFileSync('./logs/order-execution.log', 
          `QUOTES SUCCESS: ${symbol1}=${JSON.stringify(quote1)}, ${symbol2}=${JSON.stringify(quote2)}\n`
        );

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
        fs.appendFileSync('./logs/order-execution.log', 
          `QUOTE ERROR (attempt ${attempt}): ${error.message}\n`
        );
        
        // If this is the last attempt, return null
        if (attempt > maxRetries) {
          console.error('Error getting current quotes after retries:', error.message);
          return [null, null];
        }
        
        // Wait before retrying (2 seconds, increasing delay)
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  // Close active trade
  async closeTrade(tradeId, userId, reason = 'Manual') {
    try {
      const activeTrade = await ActiveTrade.findOne({
        where: { tradeId, userId },
        include: [
          { model: Broker, as: 'broker1' },
          { model: Broker, as: 'broker2' }
        ]
      });

      if (!activeTrade) {
        throw new Error('Active trade not found');
      }

      // Close orders on both brokers
      const closeResults = await Promise.all([
        this.closeOrderOnBroker(activeTrade.broker1, activeTrade.broker1Ticket),
        this.closeOrderOnBroker(activeTrade.broker2, activeTrade.broker2Ticket)
      ]);

      // Get current quotes for close premium calculation
      const [futureQuote, spotQuote] = await this.getCurrentQuotes(
        activeTrade.broker1, activeTrade.broker1Symbol,
        activeTrade.broker2, activeTrade.broker2Symbol
      );

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

      // Create closed trade record
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
        broker1OpenTime: activeTrade.broker1OpenTime,
        broker1Profit: closeResults[0].profit || 0,
        
        broker2Id: activeTrade.broker2Id,
        broker2Ticket: activeTrade.broker2Ticket,
        broker2Symbol: activeTrade.broker2Symbol,
        broker2Direction: activeTrade.broker2Direction,
        broker2Volume: activeTrade.broker2Volume,
        broker2OpenPrice: activeTrade.broker2OpenPrice,
        broker2ClosePrice: activeTrade.broker2Direction === 'Buy' ? spotQuote?.bid : spotQuote?.ask,
        broker2OpenTime: activeTrade.broker2OpenTime,
        broker2Profit: closeResults[1].profit || 0,
        
        executionPremium: activeTrade.executionPremium,
        closePremium,
        totalProfit: (closeResults[0].profit || 0) + (closeResults[1].profit || 0),
        takeProfit: activeTrade.takeProfit,
        stopLoss: activeTrade.stopLoss,
        closeReason: reason,
        tradeDurationMinutes,
        
        broker1Latency: activeTrade.broker1Latency,
        broker2Latency: activeTrade.broker2Latency,
        comment: activeTrade.comment,
        scalpingMode: activeTrade.scalpingMode
      });

      // Remove from active trades
      await activeTrade.destroy();

      return {
        success: true,
        closedTrade,
        closeResults
      };

    } catch (error) {
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
                              takeProfit, stopLoss, scalpingMode, userId, accountSetId) {
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
      // If only one failed, we need to close the successful one
      if (broker1Result.success && broker2Result.ticket) {
        // TODO: Implement order close for broker1
      }
      if (broker2Result.success && broker1Result.ticket) {
        // TODO: Implement order close for broker2
      }

      throw new Error(
        `Order execution failed. Broker1: ${broker1Result.success ? 'OK' : broker1Result.error}, ` +
        `Broker2: ${broker2Result.success ? 'OK' : broker2Result.error}`
      );
    }

    if (!broker1Result.ticket || !broker2Result.ticket) {
      throw new Error('Orders executed but ticket numbers not received');
    }
    
    // Create ActiveTrade record
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
      stopLoss,
      scalpingMode,
      comment: comment,
      status: 'Active'
    });

    // Store latency data in AccountSet for persistence
    await accountSet.update({
      lastOrderBroker1Latency: broker1Result.latency,
      lastOrderBroker2Latency: broker2Result.latency,
      lastOrderTimestamp: new Date()
    });

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
  }
}

module.exports = new TradingService();