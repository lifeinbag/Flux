// server/routes/premiumData.js
const express = require('express');
const router = express.Router();
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const auth = require('../middleware/auth');
const axios = require('axios');
const brokerStatusLogger = require('../utils/brokerStatusLogger');
const logLevelController = require('../utils/logLevelController');
const simpleStatusLogger = require('../utils/simpleStatusLogger');

// Store active premium recording intervals
const premiumIntervals = new Map();

// ✅ FIXED: Simplified getValidToken function with better error handling
async function getValidToken(broker) {
  const now = Date.now();
  
  // Check database token first (with 5-minute buffer)
  const tokenValid = broker.token && 
                    broker.tokenExpiresAt && 
                    new Date(broker.tokenExpiresAt).getTime() > (now + 300000);
  
  if (tokenValid) {
    simpleStatusLogger.updateBrokerStatus(broker.server, broker.accountNumber, broker.terminal, 'token', 'success');
    return broker.token;
  }
  
  // Fetching new token...
  
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
    
    simpleStatusLogger.updateBrokerStatus(broker.server, broker.accountNumber, broker.terminal, 'token', 'success');
    return token;
    
  } catch (error) {
    simpleStatusLogger.updateBrokerStatus(broker.server, broker.accountNumber, broker.terminal, 'token', 'failed', error.message);
    throw error;
  }
}

// Helper: Ensure both brokers have valid tokens (optimized)
async function ensureBrokerTokens(broker1, broker2) {
  try {
    await getValidToken(broker1);
  } catch (err) {
    console.error(`❌ Failed to get token for Broker 1:`, err.message);
  }
  
  try {
    await getValidToken(broker2);
  } catch (err) {
    console.error(`❌ Failed to get token for Broker 2:`, err.message);
  }
}

// Helper: Fetch quotes with MT5/MT4 fallback
async function fetchQuote(token, symbol) {
  const enc = encodeURIComponent(symbol);
  
  // Use standard API URL environment variables
  const MT5_URL = process.env.MT5_API_URL;
  const MT4_URL = process.env.MT4_API_URL;
  
  if (!MT5_URL && !MT4_URL) {
    throw new Error('Missing required environment variables: MT5_API_URL or MT4_API_URL must be set');
  }
  
try {
  if (MT5_URL) {
    const res = await axios.get(`${MT5_URL}/GetQuote?id=${token}&symbol=${enc}`, {
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });
    return res.data;
  }
} catch {
  if (MT4_URL) {
    const res2 = await axios.get(`${MT4_URL}/GetQuote?id=${token}&symbol=${enc}`, {
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });
    return res2.data;
  }
}
throw new Error('All API endpoints failed to respond');
}

// Create or get premium table for a company
async function createPremiumTable(companyName, accountSetId) {
  const tableName = `premium_${companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  
  try {
    await sequelize.getQueryInterface().dropTable(tableName, { cascade: true })
      .catch(() => {});
    
    // Create table with standardized schema (matching dataCollectionManager format)
    await sequelize.query(`
      CREATE TABLE "${tableName}" (
        id SERIAL PRIMARY KEY,
        account_set_id VARCHAR(255),
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        future_bid DECIMAL(15, 8),
        future_ask DECIMAL(15, 8),
        spot_bid DECIMAL(15, 8),
        spot_ask DECIMAL(15, 8),
        buy_premium DECIMAL(15, 8),
        sell_premium DECIMAL(15, 8)
      )
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_${tableName}_account_timestamp" 
      ON "${tableName}" (account_set_id, timestamp)
    `);
    
    console.log(`Created premium table: ${tableName} with correct schema`);
    startPremiumRecording(tableName, accountSetId);
    return tableName;
  } catch (err) {
    console.error(`Error creating premium table ${tableName}:`, err);
    throw err;
  }
}

// Start recording premium data every minute
function startPremiumRecording(tableName, accountSetId) {
  const intervalKey = `${tableName}_${accountSetId}`;
  
  if (premiumIntervals.has(intervalKey)) {
    clearInterval(premiumIntervals.get(intervalKey));
  }
  
  const interval = setInterval(async () => {
    try {
      await recordPremiumData(tableName, accountSetId);
    } catch (err) {
      console.error(`Error recording premium data for ${tableName}:`, err);
    }
  }, 1000);
  
  premiumIntervals.set(intervalKey, interval);
  console.log(`Started premium recording for ${tableName}, account set ${accountSetId}`);
}

// ✅ OPTIMIZED: Record premium data using database-first approach
async function recordPremiumData(tableName, accountSetId) {
  try {
    const setId = typeof accountSetId === 'object' ? 
      accountSetId.id || accountSetId._id : accountSetId;
    
    if (!setId) {
      console.log(`⚠️ Skipping premium recording - Invalid accountSetId: ${JSON.stringify(accountSetId)}`);
      return;
    }
    
    const { AccountSet } = require('../models/AccountSet');
    const databaseQuoteService = require('../services/databaseQuoteService');
    const intelligentNormalizer = require('../utils/intelligentBrokerNormalizer');
    
    const accountSet = await AccountSet.findByPk(setId, { include: ['brokers'] });
    
    if (!accountSet?.futureSymbol || !accountSet?.spotSymbol || accountSet.brokers.length < 2) {
      console.log(`⚠️ Skipping premium recording - Missing data for AccountSet ${setId}`);
      return;
    }
    
    const [broker1, broker2] = accountSet.brokers;
    
    // Get normalized broker names for database lookup
    const normalizedBroker1 = await intelligentNormalizer.normalizeBrokerName(
      broker1.brokerName, broker1.server, broker1.companyName
    );
    const normalizedBroker2 = await intelligentNormalizer.normalizeBrokerName(
      broker2.brokerName, broker2.server, broker2.companyName
    );

    // ✅ DATABASE-FIRST: Get quotes from database cache
    // ✅ DATABASE-FIRST: Get quotes from database cache
    let futureQuote = await databaseQuoteService.getQuoteFromDatabase(normalizedBroker1, accountSet.futureSymbol);
    let spotQuote = await databaseQuoteService.getQuoteFromDatabase(normalizedBroker2, accountSet.spotSymbol);

    // Only call API if database cache is stale (> 10 seconds for premium recording)
    if (!databaseQuoteService.isQuoteFresh(futureQuote, 10000)) {
      // Fetching fresh future quote...
      await ensureBrokerTokens(broker1, broker2);
      if (broker1.token) {
        const apiQuote = await fetchQuote(broker1.token, accountSet.futureSymbol).catch(() => null);
        if (apiQuote) {
          futureQuote = {
            bid: apiQuote.Bid,
            ask: apiQuote.Ask,
            symbol: accountSet.futureSymbol,
            timestamp: new Date(),
            source: 'api'
          };
        }
      }
    } else {
      // Using cached future quote
    }

    if (!databaseQuoteService.isQuoteFresh(spotQuote, 10000)) {
      // Fetching fresh spot quote...
      await ensureBrokerTokens(broker1, broker2);
      if (broker2.token) {
        const apiQuote = await fetchQuote(broker2.token, accountSet.spotSymbol).catch(() => null);
        if (apiQuote) {
          spotQuote = {
            bid: apiQuote.Bid,
            ask: apiQuote.Ask,
            symbol: accountSet.spotSymbol,
            timestamp: new Date(),
            source: 'api'
          };
        }
      }
    } else {
      // Using cached spot quote
    }
    
    if (!futureQuote || !spotQuote) {
      return; // Failed to get quotes
    }
    
    // Calculate premiums
    const buyPremium = futureQuote.ask - spotQuote.bid;
    const sellPremium = futureQuote.bid - spotQuote.ask;
    
    // Insert data using standardized schema
    await sequelize.query(
      `INSERT INTO "${tableName}" 
       (account_set_id, future_bid, future_ask, spot_bid, spot_ask, buy_premium, sell_premium)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [setId, futureQuote.bid, futureQuote.ask, spotQuote.bid, spotQuote.ask, buyPremium, sellPremium],
        type: Sequelize.QueryTypes.INSERT
      }
    );
    
    // Premium recorded successfully
  } catch (err) {
    console.error(`Error in recordPremiumData for ${tableName}:`, err);
  }
}

// Stop premium recording for account set
function stopPremiumRecording(tableName, accountSetId) {
  const intervalKey = `${tableName}_${accountSetId}`;
  
  if (premiumIntervals.has(intervalKey)) {
    clearInterval(premiumIntervals.get(intervalKey));
    premiumIntervals.delete(intervalKey);
    console.log(`Stopped premium recording for ${tableName}, account set ${accountSetId}`);
  }
}

// ✅ OPTIMIZED: GET premium data using database service
router.get('/:companyName/:accountSetId', auth, async (req, res) => {
  try {
    const { companyName, accountSetId } = req.params;
    const { limit = 1000 } = req.query;
    
    const databaseQuoteService = require('../services/databaseQuoteService');
    const normalized = companyName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const likePattern = `premium_${normalized}%`;
    
    // Find premium table
    const tables = await sequelize.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE :pattern
       ORDER BY table_name LIMIT 1`,
      {
        replacements: { pattern: likePattern },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    
    if (!tables.length) {
      console.error(`Premium table not found for pattern ${likePattern}`);
      return res.status(404).json({
        success: false,
        error: `Premium table not found: premium_${normalized}`
      });
    }
    
    const tableName = tables[0].table_name;
    
    // Use database service for efficient data retrieval
    const data = await databaseQuoteService.getRecentPremiumData(tableName, accountSetId, parseInt(limit));
    
    res.json({ 
      success: true, 
      data,
      meta: {
        tableName,
        recordCount: data.length,
        source: 'database'
      }
    });
  } catch (err) {
    console.error('Error fetching premium data:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch premium data' });
  }
});

// DELETE premium recording for account set
router.delete('/:companyName/:accountSetId', auth, async (req, res) => {
  try {
    const { companyName, accountSetId } = req.params;
    const normalized = companyName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const likePattern = `premium_${normalized}%`;
    
    const tables = await sequelize.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE :pattern
       ORDER BY table_name LIMIT 1`,
      {
        replacements: { pattern: likePattern },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    
    if (tables.length) {
      stopPremiumRecording(tables[0].table_name, accountSetId);
    } else {
      console.warn(`Premium table not found when stopping recording for pattern ${likePattern}`);
    }
    
    res.json({ success: true, message: 'Premium recording stopped' });
  } catch (err) {
    console.error('Error stopping premium recording:', err);
    res.status(500).json({ success: false, error: 'Failed to stop premium recording' });
  }
});

// Get broker status summary
router.get('/status/brokers', auth, async (req, res) => {
  try {
    const statusSummary = brokerStatusLogger.getStatusSummary();
    res.json({
      success: true,
      data: statusSummary
    });
  } catch (error) {
    console.error('❌ Error getting broker status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Control logging settings
router.post('/logging/toggle-verbose', auth, async (req, res) => {
  try {
    const verboseEnabled = logLevelController.toggleVerboseLogging();
    res.json({
      success: true,
      data: {
        verboseLogging: verboseEnabled,
        message: verboseEnabled ? 'Verbose logging enabled' : 'Verbose logging disabled'
      }
    });
  } catch (error) {
    console.error('❌ Error toggling verbose logging:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/logging/toggle-status', auth, async (req, res) => {
  try {
    const statusEnabled = logLevelController.toggleStatusDisplay();
    res.json({
      success: true,
      data: {
        statusDisplayEnabled: statusEnabled,
        message: statusEnabled ? 'Status display enabled' : 'Status display disabled'
      }
    });
  } catch (error) {
    console.error('❌ Error toggling status display:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/logging/settings', auth, async (req, res) => {
  try {
    const settings = logLevelController.getSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ Error getting logging settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/logging/suppressed', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const suppressedMessages = logLevelController.getSuppressedMessages(limit);
    res.json({
      success: true,
      data: suppressedMessages
    });
  } catch (error) {
    console.error('❌ Error getting suppressed messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
module.exports.createPremiumTable = createPremiumTable;
module.exports.stopPremiumRecording = stopPremiumRecording;