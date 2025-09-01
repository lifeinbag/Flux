// server/services/tradeSessionService.js
const axios = require('axios');
const https = require('https');
const logger = require('../utils/logger');

const mt4Client = axios.create({
  baseURL: process.env.MT4_API_URL,
  timeout: 10000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

const mt5Client = axios.create({
  baseURL: process.env.MT5_API_URL,
  timeout: 10000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

class TradeSessionService {
  constructor() {
    // Cache trade session status to avoid repeated calls
    // Format: { "symbol-terminal": { isOpen: boolean, timestamp: number, expiresAt: number } }
    this.sessionCache = new Map();
    this.cacheTimeoutMs = 60000; // Cache for 60 seconds
  }

  /**
   * Check if trading session is open for a symbol
   * @param {string} symbol - Trading symbol (e.g., 'XAUUSD', 'GCZ25')
   * @param {string} terminal - 'MT4' or 'MT5'
   * @param {string} token - Broker token
   * @returns {Promise<boolean>} - True if session is open, false if closed
   */
  async isTradeSessionOpen(symbol, terminal, token) {
    try {
      const cacheKey = `${symbol}-${terminal}`;
      const now = Date.now();
      
      // Check cache first
      const cached = this.sessionCache.get(cacheKey);
      if (cached && now < cached.expiresAt) {
        logger.info(`🏠 Trade session cached: ${symbol} (${terminal}) = ${cached.isOpen}`);
        return cached.isOpen;
      }

      // Make API call
      const client = terminal === 'MT5' ? mt5Client : mt4Client;
      const response = await client.get('/IsTradeSession', {
        params: { id: token, symbol: symbol }
      });

      const isOpen = response.data === true || response.data === 'true';
      
      // Cache the result
      this.sessionCache.set(cacheKey, {
        isOpen,
        timestamp: now,
        expiresAt: now + this.cacheTimeoutMs
      });

      logger.info(`🌍 Trade session checked: ${symbol} (${terminal}) = ${isOpen}`);
      return isOpen;

    } catch (error) {
      logger.error(`❌ Trade session check failed for ${symbol} (${terminal}):`, error.message);
      
      // On error, assume session is open to avoid blocking operations
      // This is a safe fallback - worst case we make unnecessary calls
      return true;
    }
  }

  /**
   * Check trade session for multiple symbols at once
   * @param {Array} checks - Array of {symbol, terminal, token} objects
   * @returns {Promise<Array>} - Array of boolean results in same order
   */
  async checkMultipleSymbols(checks) {
    const promises = checks.map(({ symbol, terminal, token }) =>
      this.isTradeSessionOpen(symbol, terminal, token)
    );
    
    return Promise.all(promises);
  }

  /**
   * Clear cache for a specific symbol or all symbols
   * @param {string} symbol - Optional symbol to clear, if not provided clears all
   * @param {string} terminal - Optional terminal filter
   */
  clearCache(symbol = null, terminal = null) {
    if (symbol && terminal) {
      const cacheKey = `${symbol}-${terminal}`;
      this.sessionCache.delete(cacheKey);
      logger.info(`🧹 Cleared session cache for ${symbol} (${terminal})`);
    } else {
      this.sessionCache.clear();
      logger.info('🧹 Cleared all session cache');
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    const total = this.sessionCache.size;
    const expired = Array.from(this.sessionCache.values()).filter(
      entry => now >= entry.expiresAt
    ).length;
    
    return {
      total,
      active: total - expired,
      expired
    };
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.sessionCache.entries()) {
      if (now >= value.expiresAt) {
        this.sessionCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`🧹 Cleaned up ${cleaned} expired session cache entries`);
    }
    
    return cleaned;
  }

  /**
   * Initialize periodic cleanup
   */
  startPeriodicCleanup() {
    // Clean up expired cache every 2 minutes
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 120000);
    
    logger.info('🔄 Trade session cache periodic cleanup started');
  }
}

// Export singleton instance
module.exports = new TradeSessionService();