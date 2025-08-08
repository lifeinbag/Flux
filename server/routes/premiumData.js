// server/routes/premiumData.js
const express = require('express');
const router = express.Router();
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const auth = require('../middleware/auth');
const axios = require('axios');

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
  const MT5_URL = process.env.MT5_QUOTE_URL || 'https://injamam-001-site1.htempurl.com';
  const MT4_URL = process.env.MT4_QUOTE_URL || 'http://injamam-001-site2.htempurl.com';
  
try {
  const res = await axios.get(`${MT5_URL}/GetQuote?id=${token}&symbol=${enc}`, {
    httpsAgent: new (require('https').Agent)({
      rejectUnauthorized: false
    })
  });
  return res.data;
} catch {
  const res2 = await axios.get(`${MT4_URL}/GetQuote?id=${token}&symbol=${enc}`, {
    httpsAgent: new (require('https').Agent)({
      rejectUnauthorized: false
    })
  });
  return res2.data;
}
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

// Record premium data point (optimized with token reuse)
async function recordPremiumData(tableName, accountSetId) {
  try {
    const setId = typeof accountSetId === 'object' ? 
      accountSetId.id || accountSetId._id : accountSetId;
    
    if (!setId) {
      console.log(`⚠️ Skipping premium recording - Invalid accountSetId: ${JSON.stringify(accountSetId)}`);
      return;
    }
    
    const { AccountSet } = require('../models/AccountSet');
    const accountSet = await AccountSet.findByPk(setId, { include: ['brokers'] });
    
    if (!accountSet?.futureSymbol || !accountSet?.spotSymbol || accountSet.brokers.length < 2) {
      console.log(`⚠️ Skipping premium recording - Missing data for AccountSet ${setId}`);
      return;
    }
    
    const [broker1, broker2] = accountSet.brokers;
    
    // Use optimized token management
    await ensureBrokerTokens(broker1, broker2);
    
    if (!broker1.token || !broker2.token) {
      console.log(`⚠️ Skipping premium recording - Missing tokens for AccountSet ${setId}`);
      return;
    }
    
    // Fetch quotes
    const [futureQuote, spotQuote] = await Promise.all([
      fetchQuote(broker1.token, accountSet.futureSymbol).catch(() => null),
      fetchQuote(broker2.token, accountSet.spotSymbol).catch(() => null)
    ]);
    
    if (!futureQuote || !spotQuote) {
      console.log(`⚠️ Failed to fetch quotes for ${setId}`);
      return;
    }
    
    // Calculate premiums
    const buyPremium = futureQuote.Ask - spotQuote.Bid;
    const sellPremium = futureQuote.Bid - spotQuote.Ask;
    
    // Insert data using standardized schema (snake_case columns like dataCollectionManager)
    await sequelize.query(
      `INSERT INTO "${tableName}" 
       (account_set_id, future_bid, future_ask, spot_bid, spot_ask, buy_premium, sell_premium)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [setId, futureQuote.Bid, futureQuote.Ask, spotQuote.Bid, spotQuote.Ask, buyPremium, sellPremium],
        type: Sequelize.QueryTypes.INSERT
      }
    );
    
    console.log(`📊 Premium data recorded for ${tableName}: buy=${buyPremium?.toFixed(5)}, sell=${sellPremium?.toFixed(5)}`);
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

// GET premium data for a company/account set
router.get('/:companyName/:accountSetId', auth, async (req, res) => {
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
    
    if (!tables.length) {
      console.error(`Premium table not found for pattern ${likePattern}`);
      return res.status(404).json({
        success: false,
        error: `Premium table not found: premium_${normalized}`
      });
    }
    
    const tableName = tables[0].table_name;
    const data = await sequelize.query(
      `SELECT * FROM "${tableName}"
       WHERE account_set_id = ?
       ORDER BY timestamp DESC 
       LIMIT 1000`,
      {
        replacements: [accountSetId],
        type: Sequelize.QueryTypes.SELECT
      }
    );
    
    res.json({ success: true, data });
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

module.exports = router;
module.exports.createPremiumTable = createPremiumTable;
module.exports.stopPremiumRecording = stopPremiumRecording;