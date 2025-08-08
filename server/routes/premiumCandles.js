// server/routes/premiumCandles.js - COMPLETE DYNAMIC VERSION

const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

// Dynamic table finder - NO hardcoding
async function findPremiumTable(normalizedCompany, accountSetId = null) {
  console.log('🔍 Looking for table with company:', normalizedCompany);
  
  // If we have accountSetId, try to get the exact table from database first
  if (accountSetId) {
    try {
      const accountSet = await sequelize.query(`
        SELECT premium_table_name FROM account_sets WHERE id = $1
      `, {
        bind: [accountSetId],
        type: Sequelize.QueryTypes.SELECT
      });
      
      if (accountSet.length > 0 && accountSet[0].premium_table_name) {
        const tableName = accountSet[0].premium_table_name;
        console.log('✅ Found exact table from AccountSet:', tableName);
        
        // Verify table exists
        const [tableExists] = await sequelize.query(`SELECT to_regclass('public."${tableName}"') as exists;`);
        if (tableExists[0].exists) {
          console.log('✅ Table verified to exist:', tableName);
          return tableName;
        } else {
          console.log('⚠️ Table in AccountSet record does not exist:', tableName);
        }
      }
    } catch (error) {
      console.log('⚠️ Failed to get table from AccountSet, falling back to search:', error.message);
    }
  }
  
  try {
    const results = await sequelize.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'premium_%'
      ORDER BY table_name
    `, {
      type: Sequelize.QueryTypes.SELECT
    });
    
    console.log('🔍 All premium tables found:', results.map(t => t.table_name));
    
    if (!results || results.length === 0) {
      console.log('❌ No premium tables found');
      return null;
    }
    
    // Strategy 1: Exact match with prefix
    let match = results.find(t => t.table_name === `premium_${normalizedCompany}`);
    if (match) {
      console.log('✅ Found exact match:', match.table_name);
      return match.table_name;
    }
    
    // Strategy 2: Starts with pattern
    match = results.find(t => t.table_name.startsWith(`premium_${normalizedCompany}_`));
    if (match) {
      console.log('✅ Found starts-with match:', match.table_name);
      return match.table_name;
    }
    
    // Strategy 3: Contains all parts
    if (normalizedCompany.includes('_')) {
      const parts = normalizedCompany.split('_').filter(part => part.length > 2);
      
      // Find table that contains all parts
      for (const table of results) {
        const allPartsMatch = parts.every(part => table.table_name.includes(part));
        if (allPartsMatch) {
          console.log(`✅ Found multi-part match with parts [${parts.join(', ')}]:`, table.table_name);
          return table.table_name;
        }
      }
      
      // Find table that contains any significant part
      for (const part of parts) {
        match = results.find(t => t.table_name.includes(part));
        if (match) {
          console.log(`✅ Found partial match for "${part}":`, match.table_name);
          return match.table_name;
        }
      }
    }
    
    // Strategy 4: Simple contains
    match = results.find(t => t.table_name.includes(normalizedCompany));
    if (match) {
      console.log('✅ Found contains match:', match.table_name);
      return match.table_name;
    }
    
    // Strategy 5: If only one table exists, use it
    if (results.length === 1) {
      console.log('✅ Using single available table:', results[0].table_name);
      return results[0].table_name;
    }
    
    console.log('❌ No matching table found for:', normalizedCompany);
    console.log('📋 Available tables:', results.map(t => t.table_name));
    return null;
    
  } catch (err) {
    console.error('Error finding premium table:', err);
    return null;
  }
}

// Dynamic schema detection
async function detectTableSchema(tableName) {
  try {
    const columns = await sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, {
      bind: [tableName],
      type: Sequelize.QueryTypes.SELECT
    });
    
    const columnNames = columns.map(c => c.column_name);
    console.log('🔍 Table columns:', columnNames);
    
    // Find timestamp column
    const timestampCol = columnNames.find(col => 
      col.toLowerCase().includes('timestamp') || 
      col.toLowerCase().includes('time') ||
      col.toLowerCase().includes('date')
    ) || 'timestamp';
    
    // Find sell premium column
    const sellPremiumCol = columnNames.find(col => 
      col.toLowerCase().includes('sell') && col.toLowerCase().includes('premium')
    ) || columnNames.find(col => 
      col.toLowerCase().includes('premium')
    ) || 'sell_premium';
    
    // Find buy premium column
    const buyPremiumCol = columnNames.find(col => 
      col.toLowerCase().includes('buy') && col.toLowerCase().includes('premium')
    ) || sellPremiumCol;
    
    // Find account set id column
    const accountSetIdCol = columnNames.find(col => 
      col.toLowerCase().includes('account') && (
        col.toLowerCase().includes('set') || 
        col.toLowerCase().includes('id')
      )
    ) || 'account_set_id';
    
    return {
      timestampCol,
      sellPremiumCol,
      buyPremiumCol,
      accountSetIdCol,
      hasAccountSetId: columnNames.includes(accountSetIdCol),
      allColumns: columnNames
    };
    
  } catch (err) {
    console.error('Error detecting table schema:', err);
    return {
      timestampCol: 'timestamp',
      sellPremiumCol: 'sell_premium',
      buyPremiumCol: 'buy_premium',
      accountSetIdCol: 'account_set_id',
      hasAccountSetId: true,
      allColumns: []
    };
  }
}

// Main endpoint - Complete and dynamic
router.get('/', async (req, res) => {
  try {
	console.log('🐛 premium-candles raw query:', req.query);  
    const { tf = 15, accountSetId, days = 30, limit = 1000 } = req.query;
	
	// 👇 early validation - only accountSetId required now
  if (!accountSetId) {
    console.error('❌ premium-candles missing accountSetId:', req.query);
    return res.status(400).json({
      success: false,
      error: 'accountSetId query parameter is required'
    });
  }
    console.log('📊 Premium candles request:', { tf, accountSetId, days, limit });

    // Get table name directly from AccountSet record
    const tableName = await findPremiumTable(null, accountSetId);
    
    if (!tableName) {
      // Get all available tables for debugging
      const allTables = await sequelize.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'premium_%'
      `, {
        type: Sequelize.QueryTypes.SELECT
      });
      
      return res.json({
        success: true,
        data: [],
        timeframe: parseInt(tf),
        count: 0,
        message: `Premium table not found for AccountSet: ${accountSetId}`,
        debug: {
          accountSetId: accountSetId,
          availableTables: allTables.map(t => t.table_name),
          suggestion: allTables.length > 0 
            ? `Available tables: ${allTables.map(t => t.table_name.replace('premium_', '')).join(', ')}`
            : 'No premium tables exist'
        }
      });
    }

    console.log('✅ Using table:', tableName);

    // Detect table schema dynamically
    const schema = await detectTableSchema(tableName);
    console.log('🔍 Detected schema:', schema);

    // Check if table has data (don't filter by accountSetId for shared tables)
    const tableCheck = await sequelize.query(`
      SELECT COUNT(*) as count FROM "${tableName}"
    `, {
      type: Sequelize.QueryTypes.SELECT
    });

    if (!tableCheck[0] || tableCheck[0].count === 0) {
      return res.json({
        success: true,
        data: [],
        message: `No data found in table ${tableName}`,
        debug: {
          tableName,
          accountSetId,
          schema,
          totalRecords: tableCheck[0]?.count || 0
        }
      });
    }

    const timeframeMinutes = parseInt(tf);
    const daysToFetch = parseInt(days);
    const limitRecords = parseInt(limit);

    // Build dynamic query - Remove accountSetId filter for shared data
    const dataQuery = `
      SELECT 
        EXTRACT(EPOCH FROM "${schema.timestampCol}") as time,
        "${schema.sellPremiumCol}" as price,
        "${schema.buyPremiumCol}" as buy_price,
        "${schema.timestampCol}" as timestamp
      FROM "${tableName}"
      WHERE "${schema.sellPremiumCol}" IS NOT NULL
        AND "${schema.timestampCol}" >= NOW() - INTERVAL '${daysToFetch} days'
      ORDER BY "${schema.timestampCol}" ASC
      LIMIT ${limitRecords}
    `;

    console.log('🔍 Executing shared data query for all users...');
    console.log('📋 Query SQL:', dataQuery);

    const rawData = await sequelize.query(dataQuery, {
      type: Sequelize.QueryTypes.SELECT
    });

    console.log(`📊 Found ${rawData.length} raw data points`);

    if (rawData.length === 0) {
      // Check total records in shared table
      const totalQuery = `
        SELECT COUNT(*) as count,
               MIN("${schema.timestampCol}") as earliest,
               MAX("${schema.timestampCol}") as latest
        FROM "${tableName}"
      `;
      
      const totalResult = await sequelize.query(totalQuery, {
        type: Sequelize.QueryTypes.SELECT
      });
      
      const stats = totalResult[0];
      
      return res.json({
        success: true,
        data: [],
        timeframe: timeframeMinutes,
        count: 0,
        message: stats.count > 0 
          ? `No data in last ${daysToFetch} days. Found ${stats.count} total records from ${stats.earliest} to ${stats.latest}`
          : 'No premium data found in shared table',
        debug: {
          tableName,
          accountSetId,
          schema,
          totalRecords: parseInt(stats.count),
          earliestRecord: stats.earliest,
          latestRecord: stats.latest,
          searchDays: daysToFetch
        }
      });
    }

    // Build OHLC candles
    const candleTimeframe = timeframeMinutes * 60; // Convert to seconds
    const candleMap = new Map();

    rawData.forEach(row => {
      const bucketTime = Math.floor(row.time / candleTimeframe) * candleTimeframe;
      const price = parseFloat(row.price);

      if (isNaN(price)) return;

      if (!candleMap.has(bucketTime)) {
        candleMap.set(bucketTime, {
          time: bucketTime,
          open: price,
          high: price,
          low: price,
          close: price,
          count: 1
        });
      } else {
        const candle = candleMap.get(bucketTime);
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price;
        candle.count++;
      }
    });

    const formattedCandles = Array.from(candleMap.values())
      .sort((a, b) => a.time - b.time)
      .map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));

    console.log(`📈 Generated ${formattedCandles.length} candles for ${timeframeMinutes}m timeframe`);

    res.json({
      success: true,
      data: formattedCandles,
      timeframe: timeframeMinutes,
      count: formattedCandles.length,
      debug: {
        rawDataCount: rawData.length,
        tableName,
        accountSetId,
        schema: {
          timestampCol: schema.timestampCol,
          sellPremiumCol: schema.sellPremiumCol,
          accountSetIdCol: schema.accountSetIdCol,
          hasAccountSetId: schema.hasAccountSetId
        },
        query: dataQuery.replace(/\$1/g, accountSetId),
        firstCandle: formattedCandles[0],
        lastCandle: formattedCandles[formattedCandles.length - 1]
      }
    });

  } catch (err) {
    console.error('❌ Premium candles error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch premium candles',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Latest endpoint
router.get('/latest', async (req, res) => {
  try {
    const { company, accountSetId } = req.query;

    if (!company || !accountSetId) {
      return res.status(400).json({
        success: false,
        error: 'Company and accountSetId required'
      });
    }

    const normalized = company.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const tableName = await findPremiumTable(normalized);
    
    if (!tableName) {
      return res.json({
        success: true,
        data: null,
        message: `Premium table not found: ${normalized}`
      });
    }

    const schema = await detectTableSchema(tableName);

    const latestQuery = `
      SELECT
        EXTRACT(EPOCH FROM "${schema.timestampCol}") as time,
        "${schema.sellPremiumCol}" as sell_premium,
        "${schema.buyPremiumCol}" as buy_premium,
        "${schema.timestampCol}" as timestamp
      FROM "${tableName}"
      WHERE "${schema.sellPremiumCol}" IS NOT NULL
        ${schema.hasAccountSetId ? `AND "${schema.accountSetIdCol}" = $1` : ''}
      ORDER BY "${schema.timestampCol}" DESC
      LIMIT 1
    `;

    const latestData = await sequelize.query(latestQuery, {
      bind: schema.hasAccountSetId ? [accountSetId] : [],
      type: Sequelize.QueryTypes.SELECT
    });

    if (!latestData.length) {
      return res.json({ success: true, data: null });
    }

    const latest = latestData[0];
    res.json({
      success: true,
      data: {
        time: parseInt(latest.time),
        sellPremium: parseFloat(latest.sell_premium),
        buyPremium: parseFloat(latest.buy_premium),
        timestamp: latest.timestamp
      }
    });

  } catch (err) {
    console.error('❌ Latest premium error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest premium',
      details: err.message
    });
  }
});

// Debug endpoints
router.get('/debug-tables', async (req, res) => {
  try {
    const results = await sequelize.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'premium_%'
      ORDER BY table_name
    `, {
      type: Sequelize.QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      tables: results.map(t => t.table_name),
      count: results.length
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/debug-schema/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    
    const columns = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, {
      bind: [tableName],
      type: Sequelize.QueryTypes.SELECT
    });
    
    const schema = await detectTableSchema(tableName);
    
    const dataCount = await sequelize.query(`
      SELECT COUNT(*) as count FROM "${tableName}"
    `, {
      type: Sequelize.QueryTypes.SELECT
    });
    
    const sampleData = await sequelize.query(`
      SELECT * FROM "${tableName}" ORDER BY ${schema.timestampCol} DESC LIMIT 3
    `, {
      type: Sequelize.QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      tableName,
      columns,
      detectedSchema: schema,
      dataCount: dataCount[0],
      sampleData
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;