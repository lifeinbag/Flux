const { sequelize } = require('../models');
const intelligentNormalizer = require('../utils/intelligentBrokerNormalizer');
const logger = require('../utils/logger');

class UnifiedQuoteService {
  constructor() {
    // Get max age from environment or default to 5 seconds (much shorter than old 10s cache)
    this.maxDataAgeMs = parseInt(process.env.QUOTE_MAX_AGE_MS) || 5000;
    this.fallbackEnabled = process.env.QUOTE_FALLBACK_ENABLED !== 'false'; // Default true
  }

  /**
   * Get quotes for two brokers using unified database-first approach
   * @param {Object} broker1 - First broker object
   * @param {string} symbol1 - Symbol for first broker
   * @param {Object} broker2 - Second broker object  
   * @param {string} symbol2 - Symbol for second broker
   * @returns {Promise<Array>} Array of [quote1, quote2] or null if failed
   */
  async getQuotes(broker1, symbol1, broker2, symbol2) {
    const startTime = Date.now();
    logger.info(`🔄 UnifiedQuoteService: Getting quotes for ${symbol1} (${broker1.brokerName}) and ${symbol2} (${broker2.brokerName})`);

    try {
      // Get quotes from database first (database-first approach)
      const [dbQuote1, dbQuote2] = await Promise.all([
        this.getQuoteFromDatabase(broker1, symbol1),
        this.getQuoteFromDatabase(broker2, symbol2)
      ]);

      // Check if both quotes are fresh enough
      const quote1Fresh = this.isQuoteFresh(dbQuote1);
      const quote2Fresh = this.isQuoteFresh(dbQuote2);

      logger.info(`💾 Database quotes: ${symbol1}=${quote1Fresh ? 'FRESH' : 'STALE'}(${this.getQuoteAgeMs(dbQuote1)}ms), ${symbol2}=${quote2Fresh ? 'FRESH' : 'STALE'}(${this.getQuoteAgeMs(dbQuote2)}ms)`);

      // If both quotes are fresh, use database data
      if (quote1Fresh && quote2Fresh) {
        const duration = Date.now() - startTime;
        logger.success(`✅ Using fresh database quotes (${duration}ms)`);
        return [dbQuote1, dbQuote2];
      }

      // Fallback to API only if enabled and database data is stale
      if (this.fallbackEnabled) {
        logger.warn(`⚠️ Database quotes stale, falling back to API`);
        const apiQuotes = await this.getQuotesFromAPI(broker1, symbol1, broker2, symbol2);
        
        if (apiQuotes && apiQuotes.length === 2) {
          const duration = Date.now() - startTime;
          logger.success(`✅ Using API fallback quotes (${duration}ms)`);
          return apiQuotes;
        }
      }

      // If API fallback fails or disabled, use database data even if stale
      if (dbQuote1 && dbQuote2) {
        const duration = Date.now() - startTime;
        logger.warn(`⚠️ Using stale database quotes as last resort (${duration}ms)`);
        return [dbQuote1, dbQuote2];
      }

      logger.error(`❌ No quote data available from database or API`);
      return null;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ UnifiedQuoteService error (${duration}ms):`, error.message);
      return null;
    }
  }

  /**
   * Get quote from database for a broker/symbol (OPTIMIZED - using centralized service)
   * @param {Object} broker - Broker object
   * @param {string} symbol - Symbol to get quote for
   * @returns {Promise<Object|null>} Quote object or null
   */
  async getQuoteFromDatabase(broker, symbol) {
    try {
      // ✅ OPTIMIZED: Use centralized database quote service
      const databaseQuoteService = require('./databaseQuoteService');
      
      const quote = await databaseQuoteService.getQuoteFromDatabase(broker.brokerName, symbol);
      
      if (quote) {
        return {
          ...quote,
          broker: broker.brokerName
        };
      }

      logger.warn(`⚠️ No database quote found for ${broker.brokerName}/${symbol}`);
      return null;

    } catch (error) {
      logger.error(`❌ Database quote lookup failed for ${broker.brokerName}/${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get quotes from API (fallback only)
   * @param {Object} broker1 - First broker
   * @param {string} symbol1 - First symbol
   * @param {Object} broker2 - Second broker
   * @param {string} symbol2 - Second symbol
   * @returns {Promise<Array|null>} Array of quotes or null
   */
  async getQuotesFromAPI(broker1, symbol1, broker2, symbol2) {
    try {
      // Import tradingService only when needed (avoid circular dependency)
      const tradingService = require('./tradingService');
      
      logger.info(`🌐 Fallback: Calling API for fresh quotes`);
      const quotes = await tradingService.getCurrentQuotes(broker1, symbol1, broker2, symbol2);
      
      if (quotes && quotes.length === 2) {
        // Mark quotes as coming from API
        quotes[0].source = 'api';
        quotes[1].source = 'api';
        return quotes;
      }
      
      return null;
    } catch (error) {
      logger.error(`❌ API fallback failed:`, error.message);
      return null;
    }
  }

  /**
   * Check if a quote is fresh (OPTIMIZED - using centralized service)
   * @param {Object} quote - Quote object with timestamp
   * @returns {boolean} True if fresh, false if stale/missing
   */
  isQuoteFresh(quote) {
    // ✅ OPTIMIZED: Use centralized database quote service
    const databaseQuoteService = require('./databaseQuoteService');
    return databaseQuoteService.isQuoteFresh(quote, this.maxDataAgeMs);
  }

  /**
   * Get age of quote in milliseconds (OPTIMIZED - using centralized service)
   * @param {Object} quote - Quote object with timestamp
   * @returns {number} Age in milliseconds
   */
  getQuoteAgeMs(quote) {
    // ✅ OPTIMIZED: Use centralized database quote service
    const databaseQuoteService = require('./databaseQuoteService');
    return databaseQuoteService.getQuoteAgeMs(quote);
  }

  /**
   * Calculate premium between two quotes
   * @param {Object} futureQuote - Future/first quote
   * @param {Object} spotQuote - Spot/second quote  
   * @param {string} direction - 'Buy' or 'Sell'
   * @returns {number} Premium value
   */
  calculatePremium(futureQuote, spotQuote, direction) {
    if (!futureQuote || !spotQuote) {
      return 0;
    }

    if (direction === 'Buy') {
      return (futureQuote.ask || 0) - (spotQuote.bid || 0);
    } else {
      return (futureQuote.bid || 0) - (spotQuote.ask || 0);
    }
  }

  /**
   * Get service configuration and statistics
   * @returns {Object} Service stats
   */
  getStats() {
    return {
      maxDataAgeMs: this.maxDataAgeMs,
      fallbackEnabled: this.fallbackEnabled,
      service: 'UnifiedQuoteService',
      version: '1.0.0'
    };
  }
}

module.exports = new UnifiedQuoteService();