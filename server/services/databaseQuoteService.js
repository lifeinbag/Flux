// server/services/databaseQuoteService.js

// 🔧 DEBUG CONTROL - Reads from environment variable or defaults to false
const DEBUG_ENABLED = process.env.DEBUG_ENABLED === 'true';

const { sequelize } = require('../models');
const intelligentNormalizer = require('../utils/intelligentBrokerNormalizer');
const logger = require('../utils/logger');

class DatabaseQuoteService {
  constructor() {
    this.maxCacheAgeMs = parseInt(process.env.QUOTE_MAX_AGE_MS) || 5000; // 5 seconds default
  }

  /**
   * Get quote from database bid/ask table for a broker/symbol
   * @param {string} brokerName - Normalized broker name 
   * @param {string} symbol - Symbol to get quote for
   * @returns {Promise<Object|null>} Quote object or null
   */
  /**
   * Map symbol variations to match database storage
   * @param {string} symbol - Original symbol
   * @param {string} brokerName - Broker name for context
   * @returns {string[]} - Array of possible symbol variations to try
   */
  getSymbolVariations(symbol, brokerName) {
    const variations = [symbol]; // Always try original first
    
    // Common symbol mappings
    if (symbol.includes('m')) {
      variations.push(symbol.replace(/m$/, '')); // XAUUSDm → XAUUSD
    }
    if (symbol.includes('#')) {
      variations.push(symbol.replace(/#/g, '')); // GOLD# → GOLD
    }
    if (!symbol.includes('USD') && (symbol.includes('XAU') || symbol.includes('GOLD'))) {
      variations.push('XAUUSD'); // GCZ25 → XAUUSD (gold futures to spot)
    }
    
    return [...new Set(variations)]; // Remove duplicates
  }

  async getQuoteFromDatabase(brokerName, symbol) {
    const startTime = Date.now();
    try {
      const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(brokerName);
      const tableName = `bid_ask_${normalizedBroker}`;
      
      // 🔍 DEBUG: Check if table exists first
      if (DEBUG_ENABLED) console.log(`🔍 DATABASE DEBUG: Looking for table "${tableName}" with symbol "${symbol}"`);
      
      // Check table existence
      const [tableExists] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = :tableName
        );
      `, {
        replacements: { tableName },
        type: sequelize.QueryTypes.SELECT
      });
      
      if (!tableExists.exists) {
        if (DEBUG_ENABLED) console.log(`❌ Table "${tableName}" does not exist!`);
        return null;
      }
      
      if (DEBUG_ENABLED) console.log(`✅ Table "${tableName}" exists, trying symbol variations...`);
      
      // Try multiple symbol variations
      const symbolVariations = this.getSymbolVariations(symbol, normalizedBroker);
      if (DEBUG_ENABLED) console.log(`🔍 Trying symbol variations: ${symbolVariations.join(', ')}`);
      
      for (const symbolVariation of symbolVariations) {
        if (DEBUG_ENABLED) console.log(`🔍 Executing SQL: SELECT * FROM "${tableName}" WHERE symbol = '${symbolVariation}' LIMIT 1`);
        
        const results = await sequelize.query(`
          SELECT symbol, bid, ask, timestamp 
          FROM "${tableName}" 
          WHERE symbol = :symbol 
          ORDER BY timestamp DESC 
          LIMIT 1
        `, {
          replacements: { symbol: symbolVariation },
          type: sequelize.QueryTypes.SELECT
        });
        
        if (DEBUG_ENABLED) console.log(`🔍 Query result for ${symbolVariation}:`, results ? `${results.length} rows` : 'null');
        
        if (results && results.length > 0) {
          if (DEBUG_ENABLED) console.log(`✅ Found quote using symbol variation: "${symbolVariation}" (original: "${symbol}")`);
          const quote = results[0];
          const age = this.getQuoteAgeMs({ timestamp: quote.timestamp });
          const isStale = age > this.maxCacheAgeMs;
          
          return {
            bid: parseFloat(quote.bid),
            ask: parseFloat(quote.ask),
            symbol: quote.symbol,
            originalSymbol: symbol, // Keep track of original symbol requested
            timestamp: quote.timestamp,
            source: 'database',
            broker: brokerName,
            age: age,
            isStale: isStale,
            queryTime: Date.now() - startTime
          };
        } else {
          if (DEBUG_ENABLED) console.log(`⚠️ No quote found for variation: "${symbolVariation}"`);
        }
      }

      // If no variations worked, log and return null
      if (DEBUG_ENABLED) console.log(`📭 No quote found for any symbol variation: ${symbolVariations.join(', ')}`);
      logger.warn(`📭 No quote found in database for ${brokerName}/${symbol}`);
      return null;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      logger.error(`❌ Database quote lookup failed for ${brokerName}/${symbol} (${queryTime}ms):`, error.message);
      
      // Log specific table access issues
      if (error.message.includes('Table') && error.message.includes("doesn't exist")) {
        logger.error(`🚨 Table missing for broker: ${brokerName} - Check database setup`);
      }
      
      return null;
    }
  }



  /**
   * Get quotes for multiple broker/symbol pairs efficiently
   * @param {Array} requests - Array of {brokerName, symbol} objects
   * @returns {Promise<Array>} Array of quote results
   */
  async getMultipleQuotes(requests) {
    const promises = requests.map(req => 
      this.getQuoteFromDatabase(req.brokerName, req.symbol)
    );
    return Promise.all(promises);
  }

  /**
   * Get premium calculation from database quotes
   * @param {string} futureBroker - Future broker name
   * @param {string} futureSymbol - Future symbol
   * @param {string} spotBroker - Spot broker name  
   * @param {string} spotSymbol - Spot symbol
   * @returns {Promise<Object|null>} Premium data or null
   */
  async getPremiumFromDatabase(futureBroker, futureSymbol, spotBroker, spotSymbol) {
    try {
      const [futureQuote, spotQuote] = await Promise.all([
        this.getQuoteFromDatabase(futureBroker, futureSymbol),
        this.getQuoteFromDatabase(spotBroker, spotSymbol)
      ]);

      if (!futureQuote || !spotQuote) {
        return null;
      }

      const buyPremium = futureQuote.ask - spotQuote.bid;
      const sellPremium = futureQuote.bid - spotQuote.ask;

      return {
        buyPremium,
        sellPremium,
        futureQuote,
        spotQuote,
        timestamp: new Date(),
        source: 'database',
        dataAge: Math.max(futureQuote.age, spotQuote.age)
      };
    } catch (error) {
      logger.error(`❌ Premium calculation failed:`, error.message);
      return null;
    }
  }

  /**
   * Check if a quote is fresh (within max age)
   * @param {Object} quote - Quote object with timestamp
   * @param {number} maxAgeMs - Maximum age in milliseconds (optional)
   * @returns {boolean} True if fresh, false if stale/missing
   */
  isQuoteFresh(quote, maxAgeMs = null) {
    if (!quote || !quote.timestamp) {
      return false;
    }

    const ageMs = this.getQuoteAgeMs(quote);
    const threshold = maxAgeMs || this.maxCacheAgeMs;
    return ageMs <= threshold;
  }

  /**
   * Get age of quote in milliseconds
   * @param {Object} quote - Quote object with timestamp
   * @returns {number} Age in milliseconds
   */
  getQuoteAgeMs(quote) {
    if (!quote || !quote.timestamp) {
      return Infinity;
    }
    return Date.now() - new Date(quote.timestamp).getTime();
  }

  /**
   * Get recent premium data from premium table
   * @param {string} premiumTableName - Premium table name
   * @param {string} accountSetId - Account set ID
   * @param {number} limit - Number of records to fetch
   * @returns {Promise<Array>} Array of premium records
   */
  async getRecentPremiumData(premiumTableName, accountSetId, limit = 100) {
    try {
      const results = await sequelize.query(
        `SELECT * FROM "${premiumTableName}"
         WHERE account_set_id = :accountSetId
         ORDER BY timestamp DESC 
         LIMIT :limit`,
        {
          replacements: { accountSetId, limit },
          type: sequelize.QueryTypes.SELECT
        }
      );

      return results.map(row => ({
        ...row,
        buyPremium: parseFloat(row.buy_premium),
        sellPremium: parseFloat(row.sell_premium),
        futureBid: parseFloat(row.future_bid),
        futureAsk: parseFloat(row.future_ask),
        spotBid: parseFloat(row.spot_bid),
        spotAsk: parseFloat(row.spot_ask)
      }));
    } catch (error) {
      logger.error(`❌ Failed to fetch premium data from ${premiumTableName}:`, error.message);
      return [];
    }
  }

  /**
   * Get available symbols from a broker's bid/ask table
   * @param {string} brokerName - Broker name
   * @param {number} limit - Limit number of symbols
   * @returns {Promise<Array>} Array of symbols
   */
  async getAvailableSymbols(brokerName, limit = 100) {
    try {
      const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(brokerName);
      const tableName = `bid_ask_${normalizedBroker}`;

      const results = await sequelize.query(`
        SELECT DISTINCT symbol 
        FROM "${tableName}" 
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        ORDER BY symbol
        LIMIT :limit
      `, {
        replacements: { limit },
        type: sequelize.QueryTypes.SELECT
      });

      return results.map(row => row.symbol);
    } catch (error) {
      logger.error(`❌ Failed to get symbols for ${brokerName}:`, error.message);
      return [];
    }
  }

  /**
   * Get service statistics
   * @returns {Object} Service stats
   */
  getStats() {
    return {
      maxCacheAgeMs: this.maxCacheAgeMs,
      service: 'DatabaseQuoteService',
      version: '1.0.0',
      uptime: process.uptime()
    };
  }

  /**
   * Update max cache age setting
   * @param {number} ageMs - New max age in milliseconds
   */
  setMaxCacheAge(ageMs) {
    this.maxCacheAgeMs = ageMs;
    if (DEBUG_ENABLED) logger.info(`📝 DatabaseQuoteService max age updated to ${ageMs}ms`);
  }
}

module.exports = new DatabaseQuoteService();