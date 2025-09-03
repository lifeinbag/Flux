// server/services/persistentDataCollection.js
 const { AccountSet, Broker } = require('../models/AccountSet');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const https = require('https');
const axios = require('axios');
const intelligentNormalizer = require('../utils/intelligentBrokerNormalizer');
const simpleStatusLogger = require('../utils/simpleStatusLogger');
const brokerStatusLogger = require('../utils/brokerStatusLogger');
// TradeSession service removed - no longer checking market hours

// 🔧 DEBUG CONTROL - Reads from environment variable or defaults to false
const DEBUG_ENABLED = process.env.DEBUG_ENABLED === 'true';

const mt4Client = axios.create({
  baseURL: process.env.MT4_API_URL,
  timeout: 10_000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

const mt5Client = axios.create({
  baseURL: process.env.MT5_API_URL,
  timeout: 10_000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

class PersistentDataCollectionService {
  constructor() {
    this.activeCollections = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Trade session service removed
      const lockedSets = await AccountSet.findAll({
        where: {
          symbolsLocked: true,
          futureSymbol: { [Op.ne]: null },
          spotSymbol: { [Op.ne]: null }
        },
        include: [{
          model: Broker,
          as: 'brokers',
          separate: true,
          order: [['position', 'ASC']]
        }]
      });

      for (const set of lockedSets) {
        if (set.brokers.length === 2) {
          const futureBroker = set.brokers.find(b => b.position === 1);
          const spotBroker = set.brokers.find(b => b.position === 2);

          if (!futureBroker || !spotBroker) continue;

          const normalizedBroker1 = await intelligentNormalizer.normalizeBrokerName(
            futureBroker.brokerName,
            futureBroker.server,
            futureBroker.companyName
          );
          const normalizedBroker2 = await intelligentNormalizer.normalizeBrokerName(
            spotBroker.brokerName,
            spotBroker.server,
            spotBroker.companyName
          );

          await this.startDataCollection({
            accountSetId: set.id,
            userId: set.userId,
            company1: normalizedBroker1,
            company2: normalizedBroker2,
            futureSymbol: set.futureSymbol,
            spotSymbol: set.spotSymbol,
            broker1Token: futureBroker.token,
            broker2Token: spotBroker.token,
            broker1Terminal: futureBroker.terminal,
            broker2Terminal: spotBroker.terminal,
            premiumTableName: set.premiumTableName
          });
        }
      }

      this.initialized = true;
      logger.info(`Data collection initialized with ${lockedSets.length} active collections`);
    } catch (error) {
      logger.error('Error initializing data collection:', error.message);
    }
  }

  async startDataCollection(config) {
   const { company1, company2, futureSymbol, spotSymbol, accountSetId } = config;
   const collectionKey = `${company1}_${company2}_${futureSymbol}_${spotSymbol}_${accountSetId}`; 

    if (this.activeCollections.has(collectionKey)) {
      return;
    }

    // 🚀 ULTRA-FAST: Optimize collection interval for fastest data
    const interval = setInterval(async () => {
      try {
        await this.collectAndStorePremiumData(config);
      } catch (error) {
        logger.error(`Error in data collection for ${collectionKey}:`, error.message);
      }
    }, process.env.PREMIUM_COLLECTION_INTERVAL || 1000); // Configurable interval for premium data collection

    this.activeCollections.set(collectionKey, {
      interval,
      config,
      startedAt: new Date(),
      lastUpdate: new Date()
    });
  }

  async collectAndStorePremiumData(config) {
    const {
      company1, company2, futureSymbol, spotSymbol,
      premiumTableName, accountSetId, broker1Token, broker2Token,
      broker1Terminal, broker2Terminal
    } = config;

    try {
      // Trade session checks removed - proceeding with data collection

      // ✅ DATABASE-FIRST APPROACH: Check cache before API calls
      let futureQuote = await this.getQuoteFromBidAskTable(company1, futureSymbol);
      let spotQuote = await this.getQuoteFromBidAskTable(company2, spotSymbol);

      // Fetch fresh quotes if cache is stale
      const quoteStaleThreshold = parseInt(process.env.QUOTE_STALE_THRESHOLD_MS) || 500;
      if (!this.isQuoteFresh(futureQuote, quoteStaleThreshold)) {
        futureQuote = await this.fetchQuoteWithRetry(accountSetId, futureSymbol, 1);
        if (futureQuote) {
          await this.storeBidAskData(company1, futureSymbol, futureQuote, futureQuote.token, futureQuote.terminal);
        }
      }

      if (!this.isQuoteFresh(spotQuote, quoteStaleThreshold)) {
        spotQuote = await this.fetchQuoteWithRetry(accountSetId, spotSymbol, 2);
        if (spotQuote) {
          await this.storeBidAskData(company2, spotSymbol, spotQuote, spotQuote.token, spotQuote.terminal);
        }
      }

      if (!futureQuote || !spotQuote) {
        // Get broker information for better debugging
        const accountSet = await AccountSet.findByPk(accountSetId, {
          include: [{
            model: Broker,
            as: 'brokers',
            separate: true,
            order: [['position', 'ASC']]
          }]
        });
        
        const futureBroker = accountSet?.brokers?.find(b => b.position === 1);
        const spotBroker = accountSet?.brokers?.find(b => b.position === 2);
        
        const futureInfo = futureBroker ? `${futureBroker.accountNumber}@${futureBroker.server}` : 'Unknown';
        const spotInfo = spotBroker ? `${spotBroker.accountNumber}@${spotBroker.server}` : 'Unknown';
        
        logger.warn(`⚠️ Missing quotes for premium calculation: future=${!!futureQuote} (${company1}/${futureSymbol} - ${futureInfo}), spot=${!!spotQuote} (${company2}/${spotSymbol} - ${spotInfo}), AccountSet: ${accountSet?.name || accountSetId}`);
        return;
      }

      const buyPremium = futureQuote.ask - spotQuote.bid;
      const sellPremium = futureQuote.bid - spotQuote.ask;

      // Store premium data
      await sequelize.query(
        `INSERT INTO "${premiumTableName}" 
           (account_set_id, buy_premium, sell_premium, future_bid, future_ask, spot_bid, spot_ask, timestamp)
         VALUES (:accountSetId, :buyPremium, :sellPremium, :futureBid, :futureAsk, :spotBid, :spotAsk, NOW())`,
        {
          replacements: {
            accountSetId,
            buyPremium,
            sellPremium,
            futureBid: futureQuote.bid,
            futureAsk: futureQuote.ask,
            spotBid: spotQuote.bid,
            spotAsk: spotQuote.ask
          }
        }
      );

      // Update collection status
      const key = `${company1}_${company2}_${futureSymbol}_${spotSymbol}_${accountSetId}`;
      if (this.activeCollections.has(key)) {
        this.activeCollections.get(key).lastUpdate = new Date();
      }


    } catch (error) {
      logger.error('Error collecting premium data:', error.message);
    }
  }

  async fetchQuoteWithRetry(accountSetId, symbol, position, retryCount = 0) {
    try {
      const accountSet = await AccountSet.findByPk(accountSetId, {
        include: [{
          model: Broker,
          as: 'brokers',
          separate: true,
          order: [['position', 'ASC']]
        }]
      });

      if (!accountSet?.brokers) {
        throw new Error('Account set or brokers not found');
      }

      const broker = accountSet.brokers.find(b => b.position === position);
      if (!broker) {
        throw new Error(`Broker at position ${position} not found`);
      }

      const token = await this.getValidToken(broker);
      const quote = await this.fetchQuote(token, symbol, broker.terminal);
      
      // Add token and terminal to quote for database storage
      if (quote) {
        quote.token = token;
        quote.terminal = broker.terminal;
        
        // Log successful quote fetch to broker status
        brokerStatusLogger.logSuccess(
          accountSet.name,
          broker.brokerName,
          broker.accountNumber,
          broker.terminal,
          'quote'
        );
      }
      
      return quote;

    } catch (error) {
      if (retryCount === 0) {
        try {
          const { TokenManager } = require('../token-manager');
          const accountSet = await AccountSet.findByPk(accountSetId, {
            include: [{
              model: Broker,
              as: 'brokers',
              separate: true,
              order: [['position', 'ASC']]
            }]
          });

          const broker = accountSet?.brokers?.find(b => b.position === position);
          if (broker) {
            const cacheKey = `${broker.terminal}|${broker.server}|${broker.accountNumber}|${broker.id}`;
            TokenManager.invalidateToken(cacheKey);
          }

          return await this.fetchQuoteWithRetry(accountSetId, symbol, position, 1);
        } catch (retryError) {
          return null;
        }
      }
      return null;
    }
  }

  // ✅ FIXED: Simplified getValidToken function with better error handling
  async getValidToken(broker) {
    const now = Date.now();
    
    // Check database token first (with 5-minute buffer)
    const tokenValid = broker.token &&
      broker.tokenExpiresAt &&
      new Date(broker.tokenExpiresAt).getTime() > (now + 300000);

    if (tokenValid) {
      // Using valid database token
      return broker.token;
    }

    if (DEBUG_ENABLED) console.log(`🔄 Fetching new token for ${broker.terminal} ${broker.accountNumber}...`);

    try {
      // Clear expired token
      broker.token = null;
      broker.tokenExpiresAt = null;
      await broker.save();

      // Use simplified TokenManager
      const { TokenManager } = require('../token-manager');
      const token = await TokenManager.getToken(
        broker.terminal === 'MT5',
        broker.server,
        broker.accountNumber,
        broker.password,
        broker.id
      );

      // Save to database
      broker.token = token;
      broker.tokenExpiresAt = new Date(Date.now() + 22 * 60 * 60 * 1000);
      await broker.save();

      if (DEBUG_ENABLED) console.log(`✅ New token saved for ${broker.terminal} ${broker.accountNumber}`);
      return token;

    } catch (error) {
      console.error(`❌ Token fetch failed for ${broker.terminal} ${broker.accountNumber}:`, error.message);
      throw error;
    }
  }

  async fetchQuote(token, symbol, terminal) {
    const client = terminal === 'MT5' ? mt5Client : mt4Client;
    const response = await client.get('/GetQuote', {
      params: { id: token, symbol }
    });

    if (response.data?.bid && response.data?.ask) {
      return {
        bid: parseFloat(response.data.bid),
        ask: parseFloat(response.data.ask),
        symbol,
        timestamp: new Date(),
        source: 'api'
      };
    }

    return null;
  }

  // 🚀 ULTRA-FAST: Get quote from database bid/ask table with maximum optimization
  async getQuoteFromBidAskTable(brokerName, symbol) {
    try {
      const tableName = `bid_ask_${brokerName}`;
      
      const results = await sequelize.query(`
        SELECT symbol, bid, ask, timestamp 
        FROM "${tableName}" 
        WHERE symbol = $1 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, {
        bind: [symbol],
        type: sequelize.QueryTypes.SELECT,
        raw: true,
        plain: false
      });

      if (results && results.length > 0) {
        const quote = results[0];
        return {
          bid: parseFloat(quote.bid),
          ask: parseFloat(quote.ask),
          symbol: quote.symbol,
          timestamp: quote.timestamp,
          source: 'database'
        };
      }

      return null;
    } catch (error) {
      logger.error(`Database quote lookup failed for ${brokerName}/${symbol}:`, error.message);
      return null;
    }
  }

  // 🚀 ULTRA-FAST: Check if quote is fresh (within specified age) - configurable via ENV
  isQuoteFresh(quote, maxAgeMs = null) {
    const defaultThreshold = parseInt(process.env.QUOTE_FRESH_THRESHOLD_MS) || 2000;
    const threshold = maxAgeMs !== null ? maxAgeMs : defaultThreshold;
    if (!quote || !quote.timestamp) {
      return false;
    }
    const ageMs = this.getQuoteAgeMs(quote);
    return ageMs <= threshold;
  }

  // ✅ NEW: Get age of quote in milliseconds
  getQuoteAgeMs(quote) {
    if (!quote || !quote.timestamp) {
      return Infinity;
    }
    return Date.now() - new Date(quote.timestamp).getTime();
  }


  async storeBidAskData(companyName, symbol, quote, token, terminal) {
    try {
      // REMOVED: IsTradeSession check - store all quote data regardless of trade session status
      const tableName = `bid_ask_${companyName}`;

      await sequelize.query(
        `INSERT INTO "${tableName}" (symbol, bid, ask, timestamp)
         VALUES (:symbol, :bid, :ask, NOW())`,
        {
          replacements: {
            symbol,
            bid: quote.bid,
            ask: quote.ask
          }
        }
      );
      
    } catch (error) {
      logger.error(`❌ Error storing bid/ask data for ${symbol}:`, error.message);
    }
  }

  stopDataCollection(company1, company2, futureSymbol, spotSymbol, accountSetId) {
    const key = `${company1}_${company2}_${futureSymbol}_${spotSymbol}_${accountSetId}`;
    if (this.activeCollections.has(key)) {
      clearInterval(this.activeCollections.get(key).interval);
      this.activeCollections.delete(key);
      return true;
    }
    return false;
  }

  getCollectionStatus() {
    const status = [];
    for (const [key, collection] of this.activeCollections) {
      status.push({
        key,
        startedAt: collection.startedAt,
        lastUpdate: collection.lastUpdate,
        running: Date.now() - collection.lastUpdate.getTime() < 30000,
        config: {
          company1: collection.config.company1,
          company2: collection.config.company2,
          futureSymbol: collection.config.futureSymbol,
          spotSymbol: collection.config.spotSymbol
        }
      });
    }
    return status;
  }

  async cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, collection] of this.activeCollections) {
      if (now - collection.lastUpdate.getTime() > 5 * 60 * 1000) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      clearInterval(this.activeCollections.get(key).interval);
      this.activeCollections.delete(key);
    }
  }

  broadcastQuoteUpdate(accountSetId, futureSymbol, spotSymbol, futureQuote, spotQuote) {
    if (!this.wsServer || !this.clientSubscriptions) return;

    const clients = this.clientSubscriptions.get(accountSetId);
    if (!clients || clients.size === 0) return;

    const message = {
      type: 'quote_update',
      data: {
        futureSymbol,
        spotSymbol,
        futureQuote: {
          ...futureQuote,
          age: this.getQuoteAgeMs(futureQuote)
        },
        spotQuote: {
          ...spotQuote,
          age: this.getQuoteAgeMs(spotQuote)
        }
      }
    };

    const messageStr = JSON.stringify(message);
    
    clients.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(messageStr);
        } catch (error) {
          // Remove dead connections
          clients.delete(ws);
        }
      } else {
        // Remove closed connections
        clients.delete(ws);
      }
    });
  }

  getQuoteAgeMs(quote) {
    if (!quote || !quote.timestamp) return 0;
    return Date.now() - new Date(quote.timestamp).getTime();
  }

  async shutdown() {
    for (const [key, collection] of this.activeCollections) {
      clearInterval(collection.interval);
    }
    this.activeCollections.clear();
    this.initialized = false;
  }
}

module.exports = new PersistentDataCollectionService();