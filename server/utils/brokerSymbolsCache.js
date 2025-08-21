// server/utils/brokerSymbolsCache.js

const sequelize = require('../config/database');
const logger = require('./logger');
const { TokenManager } = require('../token-manager');
const intelligentNormalizer = require('./intelligentBrokerNormalizer');

class BrokerSymbolsCache {
  constructor() {
    this.symbolsCache = new Map(); // In-memory cache
    this.initializeDatabase();
  }

  async initializeDatabase() {
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS broker_symbols_cache (
          id SERIAL PRIMARY KEY,
          normalized_broker_name VARCHAR(100) NOT NULL,
          terminal VARCHAR(10) NOT NULL,
          symbols_data JSONB NOT NULL,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP,
          source_server VARCHAR(255),
          source_broker_name VARCHAR(255),
          UNIQUE(normalized_broker_name, terminal)
        )
      `);

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_broker_symbols_normalized_terminal 
        ON broker_symbols_cache (normalized_broker_name, terminal)
      `);

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_broker_symbols_expires 
        ON broker_symbols_cache (expires_at)
      `);

      logger.info('✅ Broker symbols cache initialized');
    } catch (err) {
      logger.error('Failed to initialize broker symbols cache', err.message);
    }
  }

  /**
   * Get symbols for broker - checks cache first, then fetches if needed
   */
  async getSymbolsForBroker(brokerName, serverName, terminal, token) {
    const normalizedBroker = await intelligentNormalizer.normalizeBrokerName(brokerName, serverName);
    const cacheKey = `${normalizedBroker}_${terminal}`;
    
    logger.info(`📋 Getting symbols for: ${brokerName} -> ${normalizedBroker} (${terminal})`);
    
    // 1. Check in-memory cache first
    if (this.symbolsCache.has(cacheKey)) {
      const cached = this.symbolsCache.get(cacheKey);
      if (cached.expiresAt > Date.now()) {
        const symbolCount = Array.isArray(cached.symbols) ? cached.symbols.length : Object.keys(cached.symbols || {}).length;
        logger.info(`🎯 Using in-memory cached symbols for ${normalizedBroker} ${terminal}: ${symbolCount} symbols`);
        return cached.symbols;
      } else {
        logger.info(`⏰ In-memory cache expired for ${normalizedBroker} ${terminal}`);
      }
    }

    // 2. Check database cache
    const dbCached = await this.getFromDatabase(normalizedBroker, terminal);
    if (dbCached) {
      const symbolCount = Array.isArray(dbCached.symbols_data) ? dbCached.symbols_data.length : Object.keys(dbCached.symbols_data || {}).length;
      logger.info(`📚 Using database cached symbols for ${normalizedBroker} ${terminal}: ${symbolCount} symbols`);
      // Update in-memory cache
      this.symbolsCache.set(cacheKey, {
        symbols: dbCached.symbols_data,
        expiresAt: new Date(dbCached.expires_at).getTime()
      });
      return dbCached.symbols_data;
    }

    // 3. Fetch fresh symbols and cache them
    logger.info(`🔄 Fetching fresh symbols for ${normalizedBroker} ${terminal}`);
    const freshSymbols = await this.fetchFreshSymbols(terminal, token);
    
    if (freshSymbols) {
      const symbolCount = Array.isArray(freshSymbols) ? freshSymbols.length : Object.keys(freshSymbols || {}).length;
      logger.info(`✅ Fetched fresh symbols for ${normalizedBroker} ${terminal}: ${symbolCount} symbols`);
      await this.cacheSymbols(normalizedBroker, terminal, freshSymbols, serverName, brokerName);
      return freshSymbols;
    }

    logger.error(`❌ Failed to get symbols for ${normalizedBroker} ${terminal} - all methods failed`);
    return null;
  }

  /**
   * Get symbols from database cache
   */
  async getFromDatabase(normalizedBroker, terminal) {
    try {
      const [results] = await sequelize.query(`
        SELECT symbols_data, expires_at 
        FROM broker_symbols_cache 
        WHERE normalized_broker_name = :broker 
          AND terminal = :terminal 
          AND expires_at > CURRENT_TIMESTAMP
      `, {
        replacements: { broker: normalizedBroker, terminal }
      });

      return results[0] || null;
    } catch (err) {
      logger.error('Error getting symbols from database cache', err.message);
      return null;
    }
  }

  /**
   * Fetch fresh symbols from external API
   */
  async fetchFreshSymbols(terminal, token) {
    try {
      const { client } = TokenManager.getConfig(terminal === 'MT5');
      const response = await client.get('/Symbols', { params: { id: token } });
      return response.data;
    } catch (err) {
      logger.error(`Failed to fetch fresh ${terminal} symbols`, err.message);
      return null;
    }
  }

  /**
   * Cache symbols in both database and memory
   */
  async cacheSymbols(normalizedBroker, terminal, symbols, serverName, brokerName) {
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save to database
      await sequelize.query(`
        INSERT INTO broker_symbols_cache (
          normalized_broker_name, terminal, symbols_data, 
          expires_at, source_server, source_broker_name
        ) VALUES (:broker, :terminal, :symbols, :expires, :server, :brokerName)
        ON CONFLICT (normalized_broker_name, terminal)
        DO UPDATE SET 
          symbols_data = :symbols,
          last_updated = CURRENT_TIMESTAMP,
          expires_at = :expires,
          source_server = :server,
          source_broker_name = :brokerName
      `, {
        replacements: {
          broker: normalizedBroker,
          terminal,
          symbols: JSON.stringify(symbols),
          expires: expiresAt,
          server: serverName,
          brokerName
        }
      });

      // Save to in-memory cache
      const cacheKey = `${normalizedBroker}_${terminal}`;
      this.symbolsCache.set(cacheKey, {
        symbols,
        expiresAt: expiresAt.getTime()
      });

      logger.success(`✅ Cached symbols for ${normalizedBroker} ${terminal} (${Array.isArray(symbols) ? symbols.length : Object.keys(symbols).length} symbols)`);
    } catch (err) {
      logger.error('Error caching symbols', err.message);
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache() {
    try {
      const [deleted] = await sequelize.query(`
        DELETE FROM broker_symbols_cache 
        WHERE expires_at < CURRENT_TIMESTAMP
        RETURNING id
      `);

      // Clean in-memory cache
      const now = Date.now();
      for (const [key, cached] of this.symbolsCache.entries()) {
        if (cached.expiresAt < now) {
          this.symbolsCache.delete(key);
        }
      }

      logger.info(`🧹 Cleaned ${deleted.length} expired symbol cache entries`);
    } catch (err) {
      logger.error('Error cleaning expired cache', err.message);
    }
  }

  /**
   * Get cache statistics for admin dashboard
   */
  async getCacheStats() {
    try {
      const [results] = await sequelize.query(`
        SELECT 
          normalized_broker_name,
          terminal,
          source_server,
          source_broker_name,
          last_updated,
          expires_at,
          jsonb_array_length(CASE WHEN jsonb_typeof(symbols_data) = 'array' 
                                  THEN symbols_data 
                                  ELSE jsonb_build_array() END) as symbol_count
        FROM broker_symbols_cache 
        ORDER BY last_updated DESC
      `);

      return {
        totalCachedBrokers: results.length,
        inMemoryCache: this.symbolsCache.size,
        details: results
      };
    } catch (err) {
      logger.error('Error getting cache stats', err.message);
      return { totalCachedBrokers: 0, inMemoryCache: 0, details: [] };
    }
  }

  /**
   * Force refresh symbols for a specific broker
   */
  async refreshBrokerSymbols(normalizedBroker, terminal, token, serverName, brokerName) {
    const freshSymbols = await this.fetchFreshSymbols(terminal, token);
    if (freshSymbols) {
      await this.cacheSymbols(normalizedBroker, terminal, freshSymbols, serverName, brokerName);
      logger.info(`🔄 Force refreshed symbols for ${normalizedBroker} ${terminal}`);
      return freshSymbols;
    }
    return null;
  }
}

module.exports = new BrokerSymbolsCache();