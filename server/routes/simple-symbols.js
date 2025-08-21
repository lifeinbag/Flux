// server/routes/simple-symbols.js
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const auth = require('../middleware/auth');

// ✅ SIMPLE: Get symbols from database table for a broker
router.get('/symbols/:brokerName', auth, async (req, res) => {
  try {
    const { brokerName } = req.params;
    const normalizedBroker = brokerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    console.log(`🔍 Simple symbols request for: ${brokerName} -> ${normalizedBroker}`);
    
    // Try to get from bid_ask table (most recent symbols used)
    try {
      const tableName = `bid_ask_${normalizedBroker}`;
      const results = await sequelize.query(`
        SELECT DISTINCT symbol 
        FROM "${tableName}" 
        WHERE timestamp > NOW() - INTERVAL '24 HOURS'
        ORDER BY symbol
        LIMIT 5000
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      
      const symbols = results.map(row => row.symbol);
      
      if (symbols.length > 0) {
        console.log(`✅ Found ${symbols.length} symbols from bid_ask table for ${normalizedBroker}`);
        return res.json({
          success: true,
          symbols,
          count: symbols.length,
          source: 'bid_ask_table',
          broker: normalizedBroker
        });
      }
    } catch (bidAskError) {
      console.log(`⚠️ No bid_ask table for ${normalizedBroker}:`, bidAskError.message);
    }
    
    // Fallback: Try to get from broker_symbols_cache table
    try {
      const results = await sequelize.query(`
        SELECT symbols_data 
        FROM broker_symbols_cache 
        WHERE normalized_broker_name = :broker
        ORDER BY last_updated DESC
        LIMIT 1
      `, {
        replacements: { broker: normalizedBroker },
        type: sequelize.QueryTypes.SELECT
      });
      
      if (results.length > 0) {
        const symbolsData = results[0].symbols_data;
        const symbols = Array.isArray(symbolsData) 
          ? symbolsData 
          : Object.values(symbolsData || {}).map(s => s.currency || s.symbol || s.name).filter(Boolean);
        
        console.log(`✅ Found ${symbols.length} symbols from cache table for ${normalizedBroker}`);
        return res.json({
          success: true,
          symbols,
          count: symbols.length,
          source: 'cache_table',
          broker: normalizedBroker
        });
      }
    } catch (cacheError) {
      console.log(`⚠️ No cache table data for ${normalizedBroker}:`, cacheError.message);
    }
    
    // Final fallback: Return common symbols
    const commonSymbols = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
      'EURGBP', 'EURJPY', 'GBPJPY', 'GOLD', 'XAUUSD', 'SILVER', 'XAGUSD',
      'CRUDE', 'USOIL', 'BRENT', 'NATGAS', 'BTCUSD', 'ETHUSD'
    ];
    
    console.log(`📝 Using fallback symbols for ${normalizedBroker}`);
    return res.json({
      success: true,
      symbols: commonSymbols,
      count: commonSymbols.length,
      source: 'fallback',
      broker: normalizedBroker
    });
    
  } catch (error) {
    console.error('❌ Simple symbols error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ SIMPLE: Get symbols for account set brokers
router.get('/account-set/:accountSetId/symbols', auth, async (req, res) => {
  try {
    const { accountSetId } = req.params;
    
    // Get account set with brokers
    const { AccountSet, Broker } = require('../models/AccountSet');
    const accountSet = await AccountSet.findByPk(accountSetId, {
      include: [{
        model: Broker,
        as: 'brokers',
        separate: true,
        order: [['position', 'ASC']]
      }]
    });
    
    if (!accountSet || accountSet.brokers.length < 2) {
      return res.status(404).json({
        success: false,
        error: 'Account set not found or insufficient brokers'
      });
    }
    
    const broker1 = accountSet.brokers.find(b => b.position === 1) || accountSet.brokers[0];
    const broker2 = accountSet.brokers.find(b => b.position === 2) || accountSet.brokers[1];
    
    // Get symbols for both brokers
    const getSymbolsForBroker = async (broker) => {
      const normalizedBroker = broker.brokerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Try bid_ask table first
      try {
        const tableName = `bid_ask_${normalizedBroker}`;
        const results = await sequelize.query(`
          SELECT DISTINCT symbol 
          FROM "${tableName}" 
          WHERE timestamp > NOW() - INTERVAL '24 HOURS'
          ORDER BY symbol
          LIMIT 5000
        `, {
          type: sequelize.QueryTypes.SELECT
        });
        
        const symbols = results.map(row => row.symbol);
        if (symbols.length > 0) {
          return { symbols, source: 'bid_ask_table' };
        }
      } catch (err) {
        // Continue to fallback
      }
      
      // Fallback to common symbols
      const commonSymbols = [
        'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
        'EURGBP', 'EURJPY', 'GBPJPY', 'GOLD', 'XAUUSD', 'SILVER', 'XAGUSD'
      ];
      return { symbols: commonSymbols, source: 'fallback' };
    };
    
    const [broker1Symbols, broker2Symbols] = await Promise.all([
      getSymbolsForBroker(broker1),
      getSymbolsForBroker(broker2)
    ]);
    
    res.json({
      success: true,
      data: {
        broker1: {
          id: broker1.id || broker1._id,
          name: broker1.brokerName,
          terminal: broker1.terminal,
          symbols: broker1Symbols.symbols,
          count: broker1Symbols.symbols.length,
          source: broker1Symbols.source
        },
        broker2: {
          id: broker2.id || broker2._id,
          name: broker2.brokerName,
          terminal: broker2.terminal,
          symbols: broker2Symbols.symbols,
          count: broker2Symbols.symbols.length,
          source: broker2Symbols.source
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Account set symbols error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;