const { sequelize } = require('../models');
const intelligentNormalizer = require('../utils/intelligentBrokerNormalizer');
const tradingService = require('./tradingService');

class CachedQuoteService {
  constructor() {
    this.maxCacheAgeMs = 10000; // 10 seconds - configurable
  }

  /**
   * Get quotes for two brokers, using cached data when available
   * @param {Object} broker1 - First broker object
   * @param {string} symbol1 - Symbol for first broker
   * @param {Object} broker2 - Second broker object  
   * @param {string} symbol2 - Symbol for second broker
   * @returns {Promise<Array>} Array of [quote1, quote2] or null if failed
   */
  async getQuotes(broker1, symbol1, broker2, symbol2) {
    console.log(`🔄 CachedQuoteService: Getting quotes for ${symbol1} (${broker1.brokerName}) and ${symbol2} (${broker2.brokerName})`);

    try {
      // Try to get both quotes from cache first
      const [cachedQuote1, cachedQuote2] = await Promise.all([
        this.getCachedQuoteFromDatabase(broker1, symbol1),
        this.getCachedQuoteFromDatabase(broker2, symbol2)
      ]);

      // Check if both quotes are fresh
      const quote1Fresh = this.isQuoteFresh(cachedQuote1);
      const quote2Fresh = this.isQuoteFresh(cachedQuote2);

      console.log(`💾 Cache status: ${symbol1}=${quote1Fresh ? 'FRESH' : 'STALE'}, ${symbol2}=${quote2Fresh ? 'FRESH' : 'STALE'}`);

      // If both are fresh, return cached data
      if (quote1Fresh && quote2Fresh) {
        console.log(`✅ Both quotes fresh from cache, age: ${this.getQuoteAgeMs(cachedQuote1)}ms, ${this.getQuoteAgeMs(cachedQuote2)}ms`);
        return [cachedQuote1, cachedQuote2];
      }

      // Fallback to API if cache is stale or missing
      console.log(`🌐 Falling back to API for fresh quotes`);
      const apiQuotes = await tradingService.getCurrentQuotes(
        broker1, symbol1, broker2, symbol2
      );

      if (apiQuotes && apiQuotes.length === 2) {
        console.log(`✅ Got fresh quotes from API`);
        return apiQuotes;
      }

      // If API fails but we have some cached data, use it as last resort
      if (cachedQuote1 || cachedQuote2) {
        console.log(`⚠️ API failed, using stale cached data as fallback`);
        return [
          cachedQuote1 || { bid: 0, ask: 0, symbol: symbol1 },
          cachedQuote2 || { bid: 0, ask: 0, symbol: symbol2 }
        ];
      }

      console.error(`❌ No cached data available and API failed`);
      return null;

    } catch (error) {
      console.error(`❌ CachedQuoteService error:`, error.message);
      return null;
    }
  }

  /**
   * Get cached quote from database for a broker/symbol
   * @param {Object} broker - Broker object
   * @param {string} symbol - Symbol to get quote for
   * @returns {Promise<Object|null>} Quote object or null
   */
  async getCachedQuoteFromDatabase(broker, symbol) {
    try {
      const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(
        broker.brokerName, 
        broker.server, 
        broker.companyName
      );
      
      const tableName = `bid_ask_${normalizedBroker}`;
      
      const [results] = await sequelize.query(`
        SELECT symbol, bid, ask, timestamp 
        FROM "${tableName}" 
        WHERE symbol = :symbol 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, {
        replacements: { symbol },
        type: sequelize.QueryTypes.SELECT
      });

      if (results && results.length > 0) {
        const quote = results[0];
        return {
          bid: parseFloat(quote.bid),
          ask: parseFloat(quote.ask),
          symbol: quote.symbol,
          timestamp: quote.timestamp,
          source: 'cache'
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ Database cache lookup failed for ${broker.brokerName}/${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Check if a quote is fresh (within max age)
   * @param {Object} quote - Quote object with timestamp
   * @returns {boolean} True if fresh, false if stale/missing
   */
  isQuoteFresh(quote) {
    if (!quote || !quote.timestamp) {
      return false;
    }

    const ageMs = this.getQuoteAgeMs(quote);
    return ageMs < this.maxCacheAgeMs;
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
   * Set maximum cache age in milliseconds
   * @param {number} ageMs - Max age in milliseconds
   */
  setMaxCacheAge(ageMs) {
    this.maxCacheAgeMs = ageMs;
    console.log(`📝 CachedQuoteService max age set to ${ageMs}ms`);
  }

  /**
   * Get cache statistics for monitoring
   * @returns {Object} Cache stats object
   */
  async getCacheStats() {
    try {
      // This is a simplified version - could be expanded
      return {
        maxCacheAgeMs: this.maxCacheAgeMs,
        cacheEnabled: true,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to get cache stats:', error.message);
      return { error: error.message };
    }
  }
}

module.exports = new CachedQuoteService();