const { ActiveTrade, ClosedTrade, AccountSet, Broker } = require('../models');
const axios = require('axios');
const logger = require('../utils/logger');
const { TokenManager } = require('../token-manager');
const apiErrorMonitor = require('./apiErrorMonitor');

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
            logger.error(`Failed to move trade ${trade.tradeId} to closed:`, {
              error: error.message,
              errorType: error.name,
              tradeId: trade.tradeId,
              accountSetId: trade.accountSetId,
              constraint: error.constraint || 'unknown'
            });
          }
        } else if (mt5Open && mt4Open && trade.takeProfit && trade.takeProfitMode !== 'None') {
          // Check if take profit conditions are met
          try {
            logger.info(`Checking TP conditions for trade ${trade.tradeId} - Mode: ${trade.takeProfitMode}, Target: ${trade.takeProfit}`);
            const shouldTriggerTP = await this.checkTakeProfitCondition(trade, mt5Positions, mt4Positions);
            logger.info(`TP check result for trade ${trade.tradeId}: ${shouldTriggerTP ? 'SHOULD TRIGGER' : 'NOT YET'}`);
            
            if (shouldTriggerTP) {
              logger.info(`🎯 Take profit triggered for trade ${trade.tradeId}, closing positions`);
              await this.executeTakeProfit(trade);
              movedCount++;
            }
          } catch (error) {
            logger.error(`Error checking/executing take profit for trade ${trade.tradeId}:`, error);
          }
        } else if (trade.takeProfit && trade.takeProfitMode !== 'None') {
          logger.info(`Trade ${trade.tradeId} has TP set but positions not both open - MT5: ${mt5Open}, MT4: ${mt4Open}`);
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
    const endpoint = process.env.MT5_API_URL || 'https://mt5.fluxnetwork.one:443';
    try {
      const response = await axios.get('/OpenedOrders', {
        params: { id: token },
        baseURL: endpoint,
        timeout: 10000
      });
      
      // Log successful API call
      apiErrorMonitor.logApiSuccess('MT5_FLUX', `${endpoint}/OpenedOrders`);
      
      return response.data.success !== false ? (response.data.data || response.data || []) : [];
    } catch (error) {
      // Log API error
      apiErrorMonitor.logApiError('MT5_FLUX', `${endpoint}/OpenedOrders`, error, {
        context: 'fetching_open_trades',
        token: token?.substring(0, 10) + '...'
      });
      
      logger.error('Error fetching MT5 open trades:', error);
      return [];
    }
  }

  async getMT4OpenTrades(token) {
    const endpoint = process.env.MT4_API_URL || 'https://mt4.fluxnetwork.one:443';
    try {
      const response = await axios.get('/OpenedOrders', {
        params: { id: token },
        baseURL: endpoint,
        timeout: 10000
      });
      
      // Log successful API call
      apiErrorMonitor.logApiSuccess('MT4_FLUX', `${endpoint}/OpenedOrders`);
      
      return response.data.success !== false ? (response.data.data || response.data || []) : [];
    } catch (error) {
      // Log API error
      apiErrorMonitor.logApiError('MT4_FLUX', `${endpoint}/OpenedOrders`, error, {
        context: 'fetching_open_trades',
        token: token?.substring(0, 10) + '...'
      });
      
      logger.error('Error fetching MT4 open trades:', error);
      return [];
    }
  }

  async moveToClosedTrades(activeTrade) {
    const transaction = await ActiveTrade.sequelize.transaction();
    
    try {
      // Check if this trade is already in closed trades (prevent duplicates)
      const existingClosedTrade = await ClosedTrade.findOne({
        where: { tradeId: activeTrade.tradeId },
        transaction
      });
      
      if (existingClosedTrade) {
        logger.warn(`Trade ${activeTrade.tradeId} already exists in closed trades, skipping creation`);
        // Just remove from active trades
        await activeTrade.destroy({ transaction });
        await transaction.commit();
        return;
      }
      
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
        takeProfitMode: activeTrade.takeProfitMode || 'None',
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
      logger.error(`Database error while moving trade ${activeTrade.tradeId} to closed:`, {
        error: error.message,
        errorType: error.name,
        constraint: error.constraint || 'unknown',
        detail: error.detail || 'no detail',
        tradeId: activeTrade.tradeId,
        accountSetId: activeTrade.accountSetId
      });
      
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error(`Failed to rollback transaction for trade ${activeTrade.tradeId}:`, rollbackError.message);
      }
      
      throw error;
    }
  }

  // Check if take profit conditions are met
  async checkTakeProfitCondition(trade, mt5Positions, mt4Positions) {
    try {
      const takeProfitValue = parseFloat(trade.takeProfit);
      logger.info(`TP Check - Trade ${trade.tradeId}: Mode=${trade.takeProfitMode}, Target=${takeProfitValue}`);
      
      if (trade.takeProfitMode === 'Premium') {
        // For premium mode: check deficit premium against target
        const currentPremium = await this.getCurrentPremiumForTrade(trade);
        if (currentPremium === null) {
          logger.warn(`TP Check - Trade ${trade.tradeId}: Could not get current premium`);
          return false;
        }
        
        const executionPremium = parseFloat(trade.executionPremium);
        const deficitPremium = executionPremium - currentPremium;
        logger.info(`TP Check - Trade ${trade.tradeId}: ExecutionPremium=${executionPremium}, CurrentPremium=${currentPremium}, DeficitPremium=${deficitPremium}`);
        
        const shouldTrigger = deficitPremium >= takeProfitValue;
        logger.info(`TP Check - Trade ${trade.tradeId}: DeficitPremium ${deficitPremium} ${shouldTrigger ? '>=' : '<'} Target ${takeProfitValue} = ${shouldTrigger ? 'TRIGGER' : 'WAIT'}`);
        return shouldTrigger;
        
      } else if (trade.takeProfitMode === 'Amount') {
        // For amount mode: check total profit against target dollar amount
        const currentProfit = this.calculateCurrentProfit(trade, mt5Positions, mt4Positions);
        logger.info(`TP Check - Trade ${trade.tradeId}: CurrentProfit=${currentProfit}, Target=${takeProfitValue}`);
        
        const shouldTrigger = currentProfit >= takeProfitValue;
        logger.info(`TP Check - Trade ${trade.tradeId}: CurrentProfit ${currentProfit} ${shouldTrigger ? '>=' : '<'} Target ${takeProfitValue} = ${shouldTrigger ? 'TRIGGER' : 'WAIT'}`);
        return shouldTrigger;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error checking TP condition for trade ${trade.tradeId}:`, error);
      return false;
    }
  }

  // Get current premium for a trade
  async getCurrentPremiumForTrade(trade) {
    try {
      // 🚀 OPTIMIZATION: Use database-first approach instead of direct API calls
      const databaseQuoteService = require('./databaseQuoteService');
      const intelligentNormalizer = require('../utils/intelligentBrokerNormalizer');
      
      // Get normalized broker names for database lookup
      const [normalizedBroker1, normalizedBroker2] = await Promise.all([
        intelligentNormalizer.normalizeBrokerName(trade.broker1.brokerName, trade.broker1.server, trade.broker1.companyName),
        intelligentNormalizer.normalizeBrokerName(trade.broker2.brokerName, trade.broker2.server, trade.broker2.companyName)
      ]);
      
      // Try database first (PersistentDataCollection updates every 1 second)
      let futureQuote = await databaseQuoteService.getQuoteFromDatabase(normalizedBroker1, trade.broker1Symbol);
      let spotQuote = await databaseQuoteService.getQuoteFromDatabase(normalizedBroker2, trade.broker2Symbol);
      
      // Only use API if database data is stale (> 30 seconds for TP calculations)
      if (!databaseQuoteService.isQuoteFresh(futureQuote, 30000)) {
        logger.warn(`Database quote stale for ${trade.broker1Symbol}, falling back to API`);
        
        const broker1Token = await this.getValidToken(trade.broker1, trade.broker1?.terminal === 'MT5');
        const broker1ApiUrl = trade.broker1?.terminal === 'MT4' ? 
          'https://mt4.premiumprofit.live' : 'https://mt5.premiumprofit.live';
        
        const futureQuoteResponse = await axios.get(`${broker1ApiUrl}/GetQuote`, {
          params: { id: broker1Token, symbol: trade.broker1Symbol }
        });
        
        futureQuote = {
          bid: parseFloat(futureQuoteResponse.data.bid),
          ask: parseFloat(futureQuoteResponse.data.ask)
        };
      }
      
      if (!databaseQuoteService.isQuoteFresh(spotQuote, 30000)) {
        logger.warn(`Database quote stale for ${trade.broker2Symbol}, falling back to API`);
        
        const broker2Token = await this.getValidToken(trade.broker2, trade.broker2?.terminal === 'MT5');
        const broker2ApiUrl = trade.broker2?.terminal === 'MT4' ? 
          'https://mt4.premiumprofit.live' : 'https://mt5.premiumprofit.live';
          
        const spotQuoteResponse = await axios.get(`${broker2ApiUrl}/GetQuote`, {
          params: { id: broker2Token, symbol: trade.broker2Symbol }
        });
        
        spotQuote = {
          bid: parseFloat(spotQuoteResponse.data.bid),
          ask: parseFloat(spotQuoteResponse.data.ask)
        };
      }
      
      const futureBid = parseFloat(futureQuote.bid);
      const futureAsk = parseFloat(futureQuote.ask);
      const spotBid = parseFloat(spotQuote.bid);
      const spotAsk = parseFloat(spotQuote.ask);
      
      // Calculate premium based on broker1Direction
      let premium;
      if (trade.broker1Direction === 'Buy') {
        // If broker1 is buying future, we compare future ask with spot bid
        premium = futureAsk - spotBid;
      } else {
        // If broker1 is selling future, we compare future bid with spot ask
        premium = futureBid - spotAsk;
      }
      
      return premium;
      
    } catch (error) {
      logger.error(`Error getting current premium for trade ${trade.tradeId}:`, error);
      return null;
    }
  }

  // Calculate current total profit from MT4/MT5 positions
  calculateCurrentProfit(trade, mt5Positions, mt4Positions) {
    let totalProfit = 0;

    // Find broker1 profit
    const broker1IsMT5 = trade.broker1?.terminal === 'MT5';
    const broker1Positions = broker1IsMT5 ? mt5Positions : mt4Positions;
    const broker1Position = broker1Positions.find(pos => pos.ticket?.toString() === trade.broker1Ticket);
    let broker1Profit = 0;
    if (broker1Position) {
      broker1Profit = parseFloat(broker1Position.profit || 0);
      totalProfit += broker1Profit;
      logger.info(`Profit Calc - Trade ${trade.tradeId}: Broker1 (${trade.broker1?.terminal}) Ticket ${trade.broker1Ticket} = $${broker1Profit}`);
    } else {
      logger.warn(`Profit Calc - Trade ${trade.tradeId}: Broker1 position with ticket ${trade.broker1Ticket} not found in ${trade.broker1?.terminal} positions`);
    }

    // Find broker2 profit
    const broker2IsMT5 = trade.broker2?.terminal === 'MT5';
    const broker2Positions = broker2IsMT5 ? mt5Positions : mt4Positions;
    const broker2Position = broker2Positions.find(pos => pos.ticket?.toString() === trade.broker2Ticket);
    let broker2Profit = 0;
    if (broker2Position) {
      broker2Profit = parseFloat(broker2Position.profit || 0);
      totalProfit += broker2Profit;
      logger.info(`Profit Calc - Trade ${trade.tradeId}: Broker2 (${trade.broker2?.terminal}) Ticket ${trade.broker2Ticket} = $${broker2Profit}`);
    } else {
      logger.warn(`Profit Calc - Trade ${trade.tradeId}: Broker2 position with ticket ${trade.broker2Ticket} not found in ${trade.broker2?.terminal} positions`);
    }

    logger.info(`Profit Calc - Trade ${trade.tradeId}: Total profit = $${broker1Profit} + $${broker2Profit} = $${totalProfit}`);
    return totalProfit;
  }

  // Execute take profit by closing positions
  async executeTakeProfit(trade) {
    try {
      logger.info(`🎯 Executing take profit for trade ${trade.tradeId} - Mode: ${trade.takeProfitMode}, Target: ${trade.takeProfit}`);
      
      // Get broker tokens
      const broker1Token = await this.getValidToken(trade.broker1, trade.broker1?.terminal === 'MT5');
      const broker2Token = await this.getValidToken(trade.broker2, trade.broker2?.terminal === 'MT5');
      
      logger.info(`TP Execute - Trade ${trade.tradeId}: Got tokens for both brokers`);

      // Close both positions
      const closeResults = [];

      // Close broker1 position
      try {
        const broker1ApiUrl = trade.broker1?.terminal === 'MT4' ? 
          'https://mt4.premiumprofit.live' : 'https://mt5.premiumprofit.live';
        const broker1CloseUrl = `${broker1ApiUrl}/OrderClose`;
        
        logger.info(`TP Execute - Trade ${trade.tradeId}: Closing Broker1 (${trade.broker1?.terminal}) via ${broker1CloseUrl}`);
        logger.info(`TP Execute - Broker1 params: ticket=${trade.broker1Ticket}, lots=${trade.broker1Volume}, token=${broker1Token?.substring(0,10)}...`);
        
        const broker1Response = await axios.get(`${broker1ApiUrl}/OrderClose`, {
          params: {
            id: broker1Token,
            ticket: trade.broker1Ticket,
            lots: trade.broker1Volume,
            price: 0,
            slippage: 0
          }
        });
        
        logger.info(`TP Execute - Trade ${trade.tradeId}: Broker1 close response:`, broker1Response.data);
        closeResults.push({
          broker: 'Broker 1',
          success: true,
          data: broker1Response.data,
          ticket: trade.broker1Ticket
        });
      } catch (error) {
        logger.error(`TP Execute - Trade ${trade.tradeId}: Broker1 close failed:`, error.message);
        closeResults.push({
          broker: 'Broker 1',
          success: false,
          error: error.message,
          ticket: trade.broker1Ticket
        });
      }

      // Close broker2 position
      try {
        const broker2ApiUrl = trade.broker2?.terminal === 'MT4' ? 
          'https://mt4.premiumprofit.live' : 'https://mt5.premiumprofit.live';
        const broker2CloseUrl = `${broker2ApiUrl}/OrderClose`;
        
        logger.info(`TP Execute - Trade ${trade.tradeId}: Closing Broker2 (${trade.broker2?.terminal}) via ${broker2CloseUrl}`);
        logger.info(`TP Execute - Broker2 params: ticket=${trade.broker2Ticket}, lots=${trade.broker2Volume}, token=${broker2Token?.substring(0,10)}...`);
        
        const broker2Response = await axios.get(`${broker2ApiUrl}/OrderClose`, {
          params: {
            id: broker2Token,
            ticket: trade.broker2Ticket,
            lots: trade.broker2Volume,
            price: 0,
            slippage: 0
          }
        });
        
        logger.info(`TP Execute - Trade ${trade.tradeId}: Broker2 close response:`, broker2Response.data);
        closeResults.push({
          broker: 'Broker 2',
          success: true,
          data: broker2Response.data,
          ticket: trade.broker2Ticket
        });
      } catch (error) {
        logger.error(`TP Execute - Trade ${trade.tradeId}: Broker2 close failed:`, error.message);
        closeResults.push({
          broker: 'Broker 2',
          success: false,
          error: error.message,
          ticket: trade.broker2Ticket
        });
      }

      // Create closed trade record
      const transaction = await ActiveTrade.sequelize.transaction();
      
      try {
        // Calculate total profit from close results
        let totalProfit = 0;
        closeResults.forEach(result => {
          if (result.success && result.data?.profit) {
            totalProfit += parseFloat(result.data.profit);
          }
        });

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
          broker1Profit: closeResults.find(r => r.broker === 'Broker 1' && r.success)?.data?.profit || 0,
          
          broker2Id: trade.broker2Id,
          broker2Ticket: trade.broker2Ticket,
          broker2Symbol: trade.broker2Symbol,
          broker2Direction: trade.broker2Direction,
          broker2Volume: trade.broker2Volume,
          broker2OpenPrice: trade.broker2OpenPrice,
          broker2OpenTime: trade.broker2OpenTime,
          broker2CloseTime: new Date(),
          broker2Profit: closeResults.find(r => r.broker === 'Broker 2' && r.success)?.data?.profit || 0,
          
          // Trade details
          executionPremium: trade.executionPremium,
          closePremium: 0, // Could be calculated
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
        
        logger.info(`Take profit executed successfully for trade ${trade.tradeId}`);
        this.broadcastTradeStatusChange(trade, 'closed', 'Take profit executed');
        
        const successCount = closeResults.filter(r => r.success).length;
        logger.info(`TP execution result: ${successCount}/${closeResults.length} positions closed successfully`);
        
      } catch (dbError) {
        await transaction.rollback();
        throw dbError;
      }

    } catch (error) {
      logger.error(`Failed to execute take profit for trade ${trade.tradeId}:`, error);
      throw error;
    }
  }
}

// Create singleton instance
const tradeStatusMonitor = new TradeStatusMonitor();

module.exports = tradeStatusMonitor;