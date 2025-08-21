// server/services/persistentDataCollection.js
const { AccountSet, Broker } = require('../models/AccountSet');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const https = require('https');
const axios = require('axios');
const intelligentNormalizer = require('../utils/intelligentBrokerNormalizer');

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

    const interval = setInterval(async () => {
      try {
        await this.collectAndStorePremiumData(config);
      } catch (error) {
        logger.error(`Error in data collection for ${collectionKey}:`, error.message);
      }
    }, 1000);

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
      // ✅ DATABASE-FIRST APPROACH: Check cache before API calls
      let futureQuote = await this.getQuoteFromBidAskTable(company1, futureSymbol);
      let spotQuote = await this.getQuoteFromBidAskTable(company2, spotSymbol);

      // Only fetch from API if database cache is stale (> 5 seconds)
      if (!this.isQuoteFresh(futureQuote, 5000)) {
        logger.info(`🌐 Fetching fresh future quote for ${company1}/${futureSymbol} - cache stale`);
        futureQuote = await this.fetchQuoteWithRetry(accountSetId, futureSymbol, 1);
        if (futureQuote) {
          await this.storeBidAskData(company1, futureSymbol, futureQuote, futureQuote.token, futureQuote.terminal);
        }
      } else {
        logger.info(`💾 Using cached future quote for ${company1}/${futureSymbol} - age: ${this.getQuoteAgeMs(futureQuote)}ms`);
      }

      if (!this.isQuoteFresh(spotQuote, 5000)) {
        logger.info(`🌐 Fetching fresh spot quote for ${company2}/${spotSymbol} - cache stale`);
        spotQuote = await this.fetchQuoteWithRetry(accountSetId, spotSymbol, 2);
        if (spotQuote) {
          await this.storeBidAskData(company2, spotSymbol, spotQuote, spotQuote.token, spotQuote.terminal);
        }
      } else {
        logger.info(`💾 Using cached spot quote for ${company2}/${spotSymbol} - age: ${this.getQuoteAgeMs(spotQuote)}ms`);
      }

      if (!futureQuote || !spotQuote) {
        logger.warn(`⚠️ Missing quotes for premium calculation: future=${!!futureQuote}, spot=${!!spotQuote}`);
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

      logger.info(`📊 Premium calculated: buy=${buyPremium.toFixed(5)}, sell=${sellPremium.toFixed(5)} (${futureQuote.source || 'cache'}/${spotQuote.source || 'cache'})`);

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
      
      // Add token and terminal to quote for trade session check
      if (quote) {
        quote.token = token;
        quote.terminal = broker.terminal;
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
      console.log(`✅ Using valid database token for ${broker.terminal} ${broker.accountNumber}`);
      return broker.token;
    }

    console.log(`🔄 Fetching new token for ${broker.terminal} ${broker.accountNumber}...`);

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

      console.log(`✅ New token saved for ${broker.terminal} ${broker.accountNumber}`);
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

  // ✅ NEW: Get quote from database bid/ask table
  async getQuoteFromBidAskTable(brokerName, symbol) {
    try {
      const tableName = `bid_ask_${brokerName}`;
      
      const [result] = await sequelize.query(`
        SELECT symbol, bid, ask, timestamp 
        FROM "${tableName}" 
        WHERE symbol = :symbol 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, {
        replacements: { symbol },
        type: sequelize.QueryTypes.SELECT
      });

      if (result && result.length > 0) {
        const quote = result[0];
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
      logger.error(`❌ Database quote lookup failed for ${brokerName}/${symbol}:`, error.message);
      return null;
    }
  }

  // ✅ NEW: Check if quote is fresh (within specified age)
  isQuoteFresh(quote, maxAgeMs = 5000) {
    if (!quote || !quote.timestamp) {
      return false;
    }
    const ageMs = this.getQuoteAgeMs(quote);
    return ageMs <= maxAgeMs;
  }

  // ✅ NEW: Get age of quote in milliseconds
  getQuoteAgeMs(quote) {
    if (!quote || !quote.timestamp) {
      return Infinity;
    }
    return Date.now() - new Date(quote.timestamp).getTime();
  }

  async checkIsTradeSession(token, symbol, terminal) {
    try {
      const client = terminal === 'MT5' ? mt5Client : mt4Client;
      
      const response = await client.get('/IsTradeSession', {
        params: { id: token, symbol }
      });
      
      const isTradeSession = response.data === true || response.data === 'true';
      
      if (!isTradeSession) {
        logger.info(`🚫 Symbol ${symbol} is NOT in trade session - skipping bid/ask storage`);
      }
      
      return isTradeSession;
    } catch (error) {
      logger.error(`❌ Error checking trade session for ${symbol} on ${terminal}:`, error.message);
      return false;
    }
  }

  async storeBidAskData(companyName, symbol, quote, token, terminal) {
    try {
      // Check if symbol is in trade session before storing
      const isInTradeSession = await this.checkIsTradeSession(token, symbol, terminal);
      
      if (!isInTradeSession) {
        return; // Skip storage - already logged in checkIsTradeSession
      }

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

  async shutdown() {
    for (const [key, collection] of this.activeCollections) {
      clearInterval(collection.interval);
    }
    this.activeCollections.clear();
    this.initialized = false;
  }
}

module.exports = new PersistentDataCollectionService();