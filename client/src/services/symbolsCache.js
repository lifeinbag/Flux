// client/src/services/symbolsCache.js

import API from './api';

/**
 * Optimized symbols service using broker symbol cache
 * This service provides fast symbol loading by using the server's broker_symbols_cache table
 */
class SymbolsCacheService {
  constructor() {
    this.cache = new Map(); // In-memory cache for frontend
  }

  /**
   * Get symbols for brokers in an account set using the optimized cache
   * @param {Object} accountSet - The account set object
   * @returns {Promise<Object>} - { broker1Symbols: [], broker2Symbols: [], success: boolean }
   */
  async getSymbolsForAccountSet(accountSet) {
    if (!accountSet || (!accountSet.id && !accountSet._id)) {
      return { broker1Symbols: [], broker2Symbols: [], success: false, error: 'Invalid account set' };
    }

    const accountSetId = accountSet.id || accountSet._id;
    const cacheKey = `accountSet_${accountSetId}`;
    
    // Check in-memory cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
        console.log(`🎯 Using frontend cached symbols for account set ${accountSetId}: Broker1=${cached.data.broker1Symbols.length}, Broker2=${cached.data.broker2Symbols.length}`);
        return cached.data;
      }
    }

    try {
      // Use the new account set specific endpoint for optimal performance
      const response = await API.get(`/symbols/account-set/${accountSetId}`);
      
      if (response.data && response.data.success) {
        const result = {
          broker1Symbols: response.data.broker1Symbols || [],
          broker2Symbols: response.data.broker2Symbols || [],
          success: true,
          source: 'account_set_cache',
          meta: response.data.meta
        };

        // Cache the result
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        
        console.log(`✅ Loaded symbols for account set ${accountSetId} via cache - Broker1: ${result.broker1Symbols.length}, Broker2: ${result.broker2Symbols.length}`);
        return result;
      }

      // Fallback to individual broker loading if the account set endpoint fails
      console.log('🔄 Account set endpoint failed, falling back to individual broker loading');
      return await this.getSymbolsForAccountSetFallback(accountSet);

    } catch (error) {
      console.error('❌ SymbolsCache: Failed to load symbols for account set:', error);
      
      // Try fallback approach
      try {
        return await this.getSymbolsForAccountSetFallback(accountSet);
      } catch (fallbackError) {
        return { 
          broker1Symbols: [], 
          broker2Symbols: [], 
          success: false, 
          error: fallbackError.message 
        };
      }
    }
  }

  /**
   * Fallback method to load symbols using individual broker requests
   * @param {Object} accountSet 
   * @returns {Promise<Object>}
   */
  async getSymbolsForAccountSetFallback(accountSet) {
    if (!accountSet.brokers || accountSet.brokers.length < 2) {
      return { broker1Symbols: [], broker2Symbols: [], success: false, error: 'Insufficient brokers' };
    }

    const sortedBrokers = [...accountSet.brokers].sort((a, b) => (a.position || 0) - (b.position || 0));
    const broker1 = sortedBrokers.find(b => b.position === 1) || sortedBrokers[0];
    const broker2 = sortedBrokers.find(b => b.position === 2) || sortedBrokers[1];

    if (!broker1 || !broker2) {
      return { broker1Symbols: [], broker2Symbols: [], success: false, error: 'Missing broker positions' };
    }

    // Use individual broker loading as fallback
    const [broker1Symbols, broker2Symbols] = await Promise.all([
      this.getSymbolsForBroker(broker1),
      this.getSymbolsForBroker(broker2)
    ]);

    return {
      broker1Symbols: broker1Symbols || [],
      broker2Symbols: broker2Symbols || [],
      success: true,
      source: 'fallback_cache'
    };
  }

  /**
   * Get symbols for a specific broker using cache
   * @param {Object} broker - Broker object with brokerName, server, terminal, etc.
   * @returns {Promise<Array>} - Array of symbol strings
   */
  async getSymbolsForBroker(broker) {
    if (!broker) return [];

    const cacheKey = `${broker.brokerName}_${broker.terminal}_${broker.server}`;
    
    // Check in-memory cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
        console.log(`🎯 Using frontend cached symbols for ${broker.brokerName} ${broker.terminal}: ${cached.symbols.length} symbols`);
        return cached.symbols;
      }
    }

    try {
      // Try broker symbols cache first (fastest)
      const normalizedBroker = this.normalizeBrokerName(broker.brokerName, broker.server);
      const cacheResponse = await API.get('/symbols/cache', {
        params: {
          broker1: normalizedBroker,
          terminal: broker.terminal
        }
      });

      if (cacheResponse.data && cacheResponse.data.broker1 && cacheResponse.data.broker1.length > 0) {
        const symbols = cacheResponse.data.broker1.map(s => s.symbol || s.display || s);
        this.cache.set(cacheKey, { symbols, timestamp: Date.now() });
        console.log(`✅ Loaded ${symbols.length} symbols from cache for ${broker.brokerName} ${broker.terminal}`);
        return symbols;
      }

      // Fallback to trading API if cache is empty
      console.log(`🔄 Cache empty, falling back to trading API for ${broker.brokerName} ${broker.terminal}`);
      const fallbackResponse = await API.get('/trading/symbols', {
        params: {
          terminal: broker.terminal,
          id: broker.id || broker._id
        }
      });

      if (fallbackResponse.data && fallbackResponse.data.success && fallbackResponse.data.symbols) {
        const raw = fallbackResponse.data.symbols;
        const symbols = Array.isArray(raw) ? raw : Object.values(raw || {});
        const processed = symbols
          .map(o => typeof o === 'string' ? o : o.currency || o.symbol || o.name)
          .filter(sym => sym && sym.trim())
          .map(s => s.trim());

        this.cache.set(cacheKey, { symbols: processed, timestamp: Date.now() });
        console.log(`✅ Loaded ${processed.length} symbols from API fallback for ${broker.brokerName} ${broker.terminal}`);
        return processed;
      }

      console.warn(`⚠️ No symbols found for ${broker.brokerName} ${broker.terminal}`);
      return [];

    } catch (error) {
      console.error(`❌ Failed to load symbols for ${broker.brokerName} ${broker.terminal}:`, error);
      return [];
    }
  }

  /**
   * Normalize broker name for cache lookup (simplified version)
   * @param {string} brokerName 
   * @param {string} server 
   * @returns {string}
   */
  normalizeBrokerName(brokerName, server) {
    if (brokerName) {
      return brokerName.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    if (server) {
      // Extract company from server name
      const parts = server.split('.');
      if (parts.length > 0) {
        let company = parts[0];
        const commonPatterns = [
          /demo$/i, /real$/i, /live$/i, /server$/i, 
          /mt[45]$/i, /-\d+$/i, /\d+$/
        ];
        
        for (const pattern of commonPatterns) {
          company = company.replace(pattern, '');
        }
        
        return company.replace(/[^a-z0-9]/gi, '').toLowerCase();
      }
    }

    return 'unknown';
  }

  /**
   * Clear the frontend cache (useful when account set changes)
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 SymbolsCache: Frontend cache cleared');
  }

  /**
   * Search for a symbol and auto-update cache if not found
   * @param {string} searchSymbol - Symbol to search for
   * @param {Array} currentSymbols - Current symbol list
   * @param {Object} broker - Broker object
   * @returns {Promise<{found: boolean, symbols: Array}>}
   */
  async searchAndUpdateSymbol(searchSymbol, currentSymbols, broker) {
    if (!searchSymbol || !broker) {
      return { found: false, symbols: currentSymbols };
    }

    // First check if symbol already exists in current list
    const symbolExists = currentSymbols.some(sym => 
      sym.toLowerCase().includes(searchSymbol.toLowerCase()) ||
      searchSymbol.toLowerCase().includes(sym.toLowerCase())
    );

    if (symbolExists) {
      return { found: true, symbols: currentSymbols };
    }

    console.log(`🔍 Symbol "${searchSymbol}" not found in cache, triggering update for ${broker.brokerName} ${broker.terminal}`);

    try {
      // Force refresh the broker symbols cache
      const refreshedSymbols = await this.refreshSymbolsForBroker(broker);
      
      // Check if symbol exists in refreshed list
      const foundInRefresh = refreshedSymbols.some(sym => 
        sym.toLowerCase().includes(searchSymbol.toLowerCase()) ||
        searchSymbol.toLowerCase().includes(sym.toLowerCase())
      );

      if (foundInRefresh) {
        console.log(`✅ Symbol "${searchSymbol}" found after cache refresh for ${broker.brokerName}`);
        return { found: true, symbols: refreshedSymbols };
      } else {
        console.log(`⚠️ Symbol "${searchSymbol}" still not found after refresh for ${broker.brokerName}`);
        return { found: false, symbols: refreshedSymbols };
      }
    } catch (error) {
      console.error(`❌ Failed to search and update symbol "${searchSymbol}":`, error);
      return { found: false, symbols: currentSymbols };
    }
  }

  /**
   * Force refresh symbols for a broker (bypasses cache and updates database)
   * @param {Object} broker 
   * @returns {Promise<Array>}
   */
  async refreshSymbolsForBroker(broker) {
    if (!broker) return [];

    try {
      console.log(`🔄 Force refreshing symbols for ${broker.brokerName} ${broker.terminal}...`);
      
      // Force refresh via trading API - this will update the database cache
      if (broker.id || broker._id) {
        await API.post('/trading/refresh-symbols', { 
          brokerId: broker.id || broker._id, 
          terminal: broker.terminal 
        });
        console.log(`✅ Database cache updated for ${broker.brokerName} ${broker.terminal}`);
      }

      // Clear frontend cache for this broker
      const cacheKey = `${broker.brokerName}_${broker.terminal}_${broker.server}`;
      this.cache.delete(cacheKey);

      // Also clear account set cache that might contain this broker
      const accountSetKeys = Array.from(this.cache.keys()).filter(key => key.startsWith('accountSet_'));
      accountSetKeys.forEach(key => this.cache.delete(key));

      // Reload symbols from updated cache
      const refreshedSymbols = await this.getSymbolsForBroker(broker);
      
      console.log(`🎯 Loaded ${refreshedSymbols.length} refreshed symbols for ${broker.brokerName} ${broker.terminal}`);
      return refreshedSymbols;
    } catch (error) {
      console.error(`❌ Failed to refresh symbols for ${broker.brokerName}:`, error);
      return [];
    }
  }
}

// Export a singleton instance
export default new SymbolsCacheService();