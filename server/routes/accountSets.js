// server/routes/accountSets.js
const express = require('express');
const router = express.Router();
const { AccountSet, Broker } = require('../models/AccountSet');
const auth = require('../middleware/auth');
const axios = require('axios');
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../utils/logger');
const persistentDataCollectionService = require('../services/persistentDataCollection');
const intelligentNormalizer = require('../utils/intelligentBrokerNormalizer');
const { TokenManager } = require('../token-manager');
const apiErrorMonitor = require('../services/apiErrorMonitor');

const DB_SCHEMA = {
  BID_ASK: {
    TABLE_PREFIX: 'bid_ask_',
    COLUMNS: { ID: 'id', SYMBOL: 'symbol', BID: 'bid', ASK: 'ask', TIMESTAMP: 'timestamp' },
    TYPES: { SYMBOL: 'VARCHAR(50)', PRECISION: 'DECIMAL(15, 8)', TIMESTAMP: 'TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP' }
  },
  PREMIUM: {
    TABLE_PREFIX: 'premium_',
    COLUMNS: {
      ID: 'id', ACCOUNT_SET_ID: 'account_set_id', TIMESTAMP: 'timestamp',
      FUTURE_BID: 'future_bid', FUTURE_ASK: 'future_ask', SPOT_BID: 'spot_bid', SPOT_ASK: 'spot_ask',
      BUY_PREMIUM: 'buy_premium', SELL_PREMIUM: 'sell_premium'
    },
    TYPES: { ACCOUNT_SET_ID: 'VARCHAR(255)', PRECISION: 'DECIMAL(15, 8)', TIMESTAMP: 'TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP' }
  }
};

const normalizeSymbol = (symbol) => {
  if (!symbol) return symbol;
  return symbol.trim();
};

async function getCompanyName(server) {
  try {
    const serverPart = server.split('.')[0].replace(/demo|real|live|server/gi, '').trim() ||
                       server.split('.')[1]?.split('-')[0];

    if (!serverPart) return server.split('.')[0];

    const MT5_SEARCH_URL = process.env.MT5_SEARCH_URL;
    const MT4_SEARCH_URL = process.env.MT4_SEARCH_URL;

    if (!MT5_SEARCH_URL || !MT4_SEARCH_URL) {
      return serverPart;
    }

    const searchUrls = [
      `${MT5_SEARCH_URL}/Search?company=${serverPart}`,
      `${MT4_SEARCH_URL}/Search?company=${serverPart}`
    ];

    for (const url of searchUrls) {
      try {
        const response = await axios.get(url, { timeout: 8000 });
        if (response.data?.company) {
          return response.data.company;
        }
      } catch (err) {
        // continue to next URL
      }
    }

    return serverPart;
  } catch (err) {
    return server.split('.')[0];
  }
}

async function updateBrokerTokens(accountSetId) {
  try {
    const accountSet = await AccountSet.findByPk(accountSetId, {
      include: [{
        model: Broker,
        as: 'brokers'
      }]
    });

    if (!accountSet?.brokers) return;

    for (const broker of accountSet.brokers) {
      try {
        const token = await TokenManager.getToken(
          broker.terminal === 'MT5',
          broker.server,
          broker.accountNumber,
          broker.password,
          broker.id
        );
        
        broker.token = token;
        broker.tokenExpiresAt = new Date(Date.now() + 22 * 60 * 60 * 1000);
        await broker.save();
      } catch (error) {
        logger.error(`Failed to update token for broker ${broker.id}:`, error.message);
      }
    }
  } catch (error) {
    logger.error('Error updating broker tokens:', error.message);
  }
}

async function createBidAskTable(normalizedBrokerName) {
  const tableName = `${DB_SCHEMA.BID_ASK.TABLE_PREFIX}${normalizedBrokerName}`;
  
  try {
    const [results] = await sequelize.query(`SELECT to_regclass('public."${tableName}"') as exists;`);
    
    if (results[0].exists) return tableName;

    await sequelize.query(`
      CREATE TABLE "${tableName}" (
        ${DB_SCHEMA.BID_ASK.COLUMNS.ID} SERIAL PRIMARY KEY,
        ${DB_SCHEMA.BID_ASK.COLUMNS.SYMBOL} ${DB_SCHEMA.BID_ASK.TYPES.SYMBOL} NOT NULL,
        ${DB_SCHEMA.BID_ASK.COLUMNS.BID} ${DB_SCHEMA.BID_ASK.TYPES.PRECISION},
        ${DB_SCHEMA.BID_ASK.COLUMNS.ASK} ${DB_SCHEMA.BID_ASK.TYPES.PRECISION},
        ${DB_SCHEMA.BID_ASK.COLUMNS.TIMESTAMP} ${DB_SCHEMA.BID_ASK.TYPES.TIMESTAMP}
      )
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_${tableName}_symbol_timestamp" 
      ON "${tableName}" (${DB_SCHEMA.BID_ASK.COLUMNS.SYMBOL}, ${DB_SCHEMA.BID_ASK.COLUMNS.TIMESTAMP})
    `);
    
    return tableName;
  } catch (err) {
    logger.error(`Error creating bid/ask table ${tableName}`, err.message);
    throw err;
  }
}

// Find existing shared premium table with same broker+symbol combination
async function findExistingSharedPremiumTable(normalizedBroker1, normalizedBroker2, futureSymbol, spotSymbol) {
  const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const expectedTableName = `${DB_SCHEMA.PREMIUM.TABLE_PREFIX}${normalizedBroker1}_${normalizedBroker2}_${normalize(futureSymbol)}_vs_${normalize(spotSymbol)}`;
  
  try {
    const [results] = await sequelize.query(`SELECT to_regclass('public."${expectedTableName}"') as exists;`);
    if (results[0].exists) {
      console.log(`🔍 Found existing shared premium table: ${expectedTableName}`);
      return expectedTableName;
    }
    return null;
  } catch (error) {
    console.error('Error checking for existing premium table:', error);
    return null;
  }
}

async function createPremiumTable(normalizedBroker1, normalizedBroker2, futureSymbol, spotSymbol) {
  const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const tableName = `${DB_SCHEMA.PREMIUM.TABLE_PREFIX}${normalizedBroker1}_${normalizedBroker2}_${normalize(futureSymbol)}_vs_${normalize(spotSymbol)}`;
  
  try {
    const [results] = await sequelize.query(`SELECT to_regclass('public."${tableName}"') as exists;`);
    
    if (results[0].exists) return tableName;

    await sequelize.query(`
      CREATE TABLE "${tableName}" (
        ${DB_SCHEMA.PREMIUM.COLUMNS.ID} SERIAL PRIMARY KEY,
        ${DB_SCHEMA.PREMIUM.COLUMNS.ACCOUNT_SET_ID} ${DB_SCHEMA.PREMIUM.TYPES.ACCOUNT_SET_ID},
        ${DB_SCHEMA.PREMIUM.COLUMNS.TIMESTAMP} ${DB_SCHEMA.PREMIUM.TYPES.TIMESTAMP},
        ${DB_SCHEMA.PREMIUM.COLUMNS.FUTURE_BID} ${DB_SCHEMA.PREMIUM.TYPES.PRECISION},
        ${DB_SCHEMA.PREMIUM.COLUMNS.FUTURE_ASK} ${DB_SCHEMA.PREMIUM.TYPES.PRECISION},
        ${DB_SCHEMA.PREMIUM.COLUMNS.SPOT_BID} ${DB_SCHEMA.PREMIUM.TYPES.PRECISION},
        ${DB_SCHEMA.PREMIUM.COLUMNS.SPOT_ASK} ${DB_SCHEMA.PREMIUM.TYPES.PRECISION},
        ${DB_SCHEMA.PREMIUM.COLUMNS.BUY_PREMIUM} ${DB_SCHEMA.PREMIUM.TYPES.PRECISION},
        ${DB_SCHEMA.PREMIUM.COLUMNS.SELL_PREMIUM} ${DB_SCHEMA.PREMIUM.TYPES.PRECISION}
      )
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_${tableName}_account_timestamp" 
      ON "${tableName}" (${DB_SCHEMA.PREMIUM.COLUMNS.ACCOUNT_SET_ID}, ${DB_SCHEMA.PREMIUM.COLUMNS.TIMESTAMP})
    `);

    return tableName;
  } catch (err) {
    logger.error(`Error creating premium table ${tableName}`, err.message);
    throw err;
  }
}

function validateBrokersArray(brokers) {
  if (!Array.isArray(brokers) || brokers.length !== 2) {
    throw new Error('Exactly 2 brokers required (MT4 and MT5).');
  }
  
  const requiredFields = ['brokerName', 'terminal', 'accountNumber', 'password', 'server'];
  for (const broker of brokers) {
    for (const field of requiredFields) {
      if (!broker[field] || typeof broker[field] !== 'string') {
        throw new Error(`Missing or invalid ${field} in broker data.`);
      }
    }
    if (!['MT4', 'MT5'].includes(broker.terminal)) {
      throw new Error('Broker terminal must be either MT4 or MT5.');
    }
  }
}

function transformAccountSet(set) {
  return {
    _id: set.id,
    id: set.id,
    name: set.name,
    userId: set.userId,
    futureSymbol: set.futureSymbol,
    spotSymbol: set.spotSymbol,
    symbolsLocked: set.symbolsLocked,
    companyMappings: set.companyMappings,
    serverMappings: set.serverMappings,
    premiumTableName: set.premiumTableName,
    brokers: set.brokers ? 
      set.brokers.map(broker => ({
        _id: broker.id,
        id: broker.id,
        brokerName: broker.brokerName,
        terminal: broker.terminal,
        server: broker.server,
        accountNumber: broker.accountNumber,
        password: broker.password,
        token: broker.token,
        tokenExpiresAt: broker.tokenExpiresAt,
        companyName: broker.companyName,
        position: broker.position
      })) : [],
    createdAt: set.createdAt,
    updatedAt: set.updatedAt
  };
}

// FIXED: Get account sets - removed separate: true
router.get('/', auth, async (req, res) => {
  try {
    const sets = await AccountSet.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Broker,
        as: 'brokers',
        required: false
      }],
      order: [
        ['createdAt', 'ASC'],
        [{ model: Broker, as: 'brokers' }, 'position', 'ASC']
      ]
    });
    
    const transformed = sets.map(transformAccountSet);
    res.json({ success: true, data: transformed });
  } catch (err) {
    logger.error('[/api/account-sets] GET error', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single account set by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const set = await AccountSet.findOne({
      where: { 
        id: req.params.id, 
        userId: req.user.id 
      },
      include: [{
        model: Broker,
        as: 'brokers',
        required: false,
        order: [['position', 'ASC']]
      }]
    });
    
    if (!set) {
      return res.status(404).json({ success: false, message: 'Account set not found' });
    }
    
    const transformed = transformAccountSet(set);
    res.json({ success: true, data: transformed });
  } catch (err) {
    logger.error(`[/api/account-sets/${req.params.id}] GET error`, err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create new account set
router.post('/', auth, async (req, res) => {
  try {
    validateBrokersArray(req.body.brokers);

    const { name, brokers } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Set name is required.');
    }

    const set = await AccountSet.create({
      userId: req.user.id,
      name: name.trim()
    });

    for (let i = 0; i < brokers.length; i++) {
      const broker = brokers[i];
      await Broker.create({
        accountSetId: set.id,
        brokerName: broker.brokerName,
        terminal: broker.terminal,
        accountNumber: broker.accountNumber,
        password: broker.password,
        server: broker.server,
        position: i + 1
      });
    }

    await updateBrokerTokens(set.id);

    const newSet = await AccountSet.findByPk(set.id, { 
      include: [{
        model: Broker,
        as: 'brokers'
      }]
    });
    res.json({ success: true, data: transformAccountSet(newSet) });
  } catch (err) {
    logger.error('[/api/account-sets] POST error', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update account set
router.patch('/:id', auth, async (req, res) => {
  try {
    const set = await AccountSet.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{
        model: Broker,
        as: 'brokers'
      }]
    });
    if (!set) {
      return res.status(404).json({ success: false, error: 'Account set not found' });
    }

    if (req.body.brokers) {
      validateBrokersArray(req.body.brokers);
    }

    const { name, brokers } = req.body;
    if (typeof name === 'string') {
      if (!name.trim()) {
        throw new Error('Set name is required.');
      }
      set.name = name.trim();
      await set.save();
    }

    if (brokers) {
      await Broker.destroy({ where: { accountSetId: set.id } });
      for (let i = 0; i < brokers.length; i++) {
        const b = brokers[i];
        await Broker.create({
          accountSetId: set.id,
          brokerName: b.brokerName,
          terminal: b.terminal,
          accountNumber: b.accountNumber,
          password: b.password,
          server: b.server,
          position: i + 1
        });
      }
      await updateBrokerTokens(set.id);
    }

    const updatedSet = await AccountSet.findByPk(set.id, { 
      include: [{
        model: Broker,
        as: 'brokers'
      }]
    });
    res.json({ success: true, data: transformAccountSet(updatedSet) });
  } catch (err) {
    logger.error(`[/api/account-sets/${req.params.id}] PATCH error`, err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Lock symbols
router.patch('/:id/symbols', auth, async (req, res) => {
  try {
    const { futureSymbol, spotSymbol } = req.body;
    if (!futureSymbol || !spotSymbol) {
      return res.status(400).json({ success: false, error: 'Both futureSymbol and spotSymbol are required' });
    }

    const set = await AccountSet.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{
        model: Broker,
        as: 'brokers'
      }]
    });
    if (!set) {
      return res.status(404).json({ success: false, error: 'Account set not found' });
    }

    if (set.brokers.length !== 2) {
      return res.status(400).json({ success: false, error: 'Account set must have exactly 2 brokers' });
    }

    set.futureSymbol = normalizeSymbol(futureSymbol);
    set.spotSymbol = normalizeSymbol(spotSymbol);
    set.symbolsLocked = true;

    await updateBrokerTokens(set.id);

    const futureBroker = set.brokers.find(b => b.position === 1);
    const spotBroker = set.brokers.find(b => b.position === 2);

    if (!futureBroker || !spotBroker) {
      return res.status(400).json({ success: false, error: 'Missing required broker positions' });
    }

    const [company1, company2] = await Promise.all([
      getCompanyName(futureBroker.server),
      getCompanyName(spotBroker.server)
    ]);

    futureBroker.companyName = company1;
    spotBroker.companyName = company2;
    await Promise.all([futureBroker.save(), spotBroker.save()]);

    set.companyMappings = {
      [futureBroker.terminal]: company1,
      [spotBroker.terminal]: company2
    };
    
    set.serverMappings = {
      [futureBroker.terminal]: futureBroker.server,
      [spotBroker.terminal]: spotBroker.server
    };

    const normalizedBroker1 = await intelligentNormalizer.normalizeBrokerName(
      futureBroker.brokerName, futureBroker.server, company1
    );
    const normalizedBroker2 = await intelligentNormalizer.normalizeBrokerName(
      spotBroker.brokerName, spotBroker.server, company2
    );

    const [bidAskTable1, bidAskTable2] = await Promise.all([
      createBidAskTable(normalizedBroker1),
      createBidAskTable(normalizedBroker2)
    ]);
    
    // Check for existing shared premium table first
    const existingTable = await findExistingSharedPremiumTable(
      normalizedBroker1, normalizedBroker2, set.futureSymbol, set.spotSymbol
    );
    
    const premiumTableName = existingTable || await createPremiumTable(
      normalizedBroker1, normalizedBroker2, set.futureSymbol, set.spotSymbol
    );

    set.premiumTableName = premiumTableName;
    
    if (existingTable) {
      console.log(`✅ Using existing shared premium table: ${existingTable}`);
    }
    await set.save();

    // Start data collection
    await persistentDataCollectionService.startDataCollection({
      accountSetId: set.id,
      userId: set.userId,
      company1: normalizedBroker1,
      company2: normalizedBroker2,
      futureSymbol: set.futureSymbol,
      spotSymbol: set.spotSymbol,
      broker1Token: futureBroker.token,
      broker2Token: spotBroker.token,
      broker1Terminal: futureBroker.terminal,
      broker2Terminal: spotBroker.terminal,
      premiumTableName: premiumTableName
    });

    res.json({
      success: true,
      message: 'Symbols locked and premium tracking started',
      data: transformAccountSet(set),
      tables: { bidAsk1: bidAskTable1, bidAsk2: bidAskTable2, premium: premiumTableName }
    });
  } catch (err) {
    logger.error(`[/api/account-sets/${req.params.id}/symbols]`, err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Unlock symbols
router.patch('/:id/unlock-symbols', auth, async (req, res) => {
  try {
    const set = await AccountSet.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{
        model: Broker,
        as: 'brokers'
      }]
    });
    if (!set) {
      return res.status(404).json({ success: false, error: 'Account set not found' });
    }
    
    // Stop data collection
    if (set.brokers.length === 2) {
      const futureBroker = set.brokers.find(b => b.position === 1);
      const spotBroker = set.brokers.find(b => b.position === 2);
      
      if (futureBroker && spotBroker) {
        const normalizedBroker1 = await intelligentNormalizer.normalizeBrokerName(
          futureBroker.brokerName, futureBroker.server, futureBroker.companyName
        );
        const normalizedBroker2 = await intelligentNormalizer.normalizeBrokerName(
          spotBroker.brokerName, spotBroker.server, spotBroker.companyName
        );
        
        persistentDataCollectionService.stopDataCollection(
          normalizedBroker1, normalizedBroker2, set.futureSymbol, set.spotSymbol
        );
      }
    }
    
    set.symbolsLocked = false;
    set.futureSymbol = '';
    set.spotSymbol = '';
    set.companyMappings = null;
    set.serverMappings = null;
    set.premiumTableName = null;
    await set.save();
    
    res.json({ 
      success: true, 
      message: 'Symbols unlocked and data collection stopped', 
      data: transformAccountSet(set) 
    });
  } catch (err) {
    logger.error(`[/api/account-sets/${req.params.id}/unlock-symbols]`, err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete account set
router.delete('/:id', auth, async (req, res) => {
  try {
    const set = await AccountSet.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{
        model: Broker,
        as: 'brokers'
      }]
    });
    if (!set) {
      return res.status(404).json({ success: false, message: 'Account set not found' });
    }
    
    // Stop data collection if running
    if (set.symbolsLocked && set.brokers.length === 2) {
      const futureBroker = set.brokers.find(b => b.position === 1);
      const spotBroker = set.brokers.find(b => b.position === 2);
      
      if (futureBroker && spotBroker) {
        const normalizedBroker1 = await intelligentNormalizer.normalizeBrokerName(
          futureBroker.brokerName, futureBroker.server, futureBroker.companyName
        );
        const normalizedBroker2 = await intelligentNormalizer.normalizeBrokerName(
          spotBroker.brokerName, spotBroker.server, spotBroker.companyName
        );
        
        persistentDataCollectionService.stopDataCollection(
          normalizedBroker1, normalizedBroker2, set.futureSymbol, set.spotSymbol
        );
      }
    }
    
    await AccountSet.destroy({ where: { id: req.params.id, userId: req.user.id } });
    
    res.json({ success: true, message: 'Account set deleted' });
  } catch (err) {
    logger.error(`[/api/account-sets/${req.params.id}] DELETE error`, err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a single broker
router.delete('/:setId/brokers/:brokerId', auth, async (req, res) => {
  const { setId, brokerId } = req.params;
  try {
    const set = await AccountSet.findOne({ where: { id: setId, userId: req.user.id } });
    if (!set) return res.status(404).json({ success: false, message: 'Account set not found' });
    
    const result = await Broker.destroy({ where: { id: brokerId, accountSetId: setId } });
    if (result === 0) return res.status(404).json({ success: false, message: 'Broker not found' });
    
    res.json({ success: true, message: 'Broker deleted' });
  } catch (err) {
    logger.error(`[/api/account-sets/${setId}/brokers/${brokerId}] DELETE error`, err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Test broker connection endpoint
router.post('/test-connection', auth, async (req, res) => {
  try {
    const { server, accountNumber, password, terminal } = req.body;
    
    if (!server || !accountNumber || !password || !terminal) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: server, accountNumber, password, terminal' 
      });
    }
    
    logger.info(`Testing connection for ${terminal} server: ${server}, account: ${accountNumber}`);
    
    try {
      const isMT5 = terminal === 'MT5';
      const token = await TokenManager.getToken(isMT5, server, accountNumber, password, null);
      
      res.json({
        success: true,
        message: 'Connection successful!',
        data: {
          server,
          accountNumber,
          terminal,
          tokenReceived: !!token,
          connectionStatus: 'connected'
        }
      });
      
    } catch (tokenError) {
      logger.error(`Connection test failed for ${server}:`, tokenError.message);
      
      // Get recent API errors related to this connection attempt
      const recentErrors = apiErrorMonitor.getRecentErrors(5)
        .filter(error => 
          error.context?.serverName === server || 
          error.context?.account?.includes(accountNumber.substring(0, 4))
        );
      
      const mostRecentError = recentErrors[0];
      
      let errorMessage = tokenError.message;
      let errorDetails = null;
      
      if (mostRecentError) {
        errorMessage = mostRecentError.userMessage || tokenError.message;
        errorDetails = {
          apiName: mostRecentError.apiName,
          severity: mostRecentError.severity,
          timestamp: mostRecentError.timestamp,
          errorType: mostRecentError.context?.errorType,
          brokerResponse: mostRecentError.context?.brokerResponse,
          connectionIssue: mostRecentError.error.network || mostRecentError.error.cors || mostRecentError.error.timeout
        };
        
        if (mostRecentError.context?.errorMessage) {
          errorDetails.externalApiError = mostRecentError.context.errorMessage;
        }
      }
      
      res.status(400).json({
        success: false,
        error: errorMessage,
        externalApiError: true, // Flag to indicate this is an external API issue
        errorDetails,
        troubleshooting: {
          isExternalApiIssue: true,
          possibleCauses: [
            'External broker API server is down',
            'CORS policy issues on external API',
            'Network connectivity problems',
            'Invalid server name or credentials',
            'Broker server maintenance'
          ],
          recommendation: 'This appears to be an issue with the external broker API, not our application. Please check the external service status or try again later.'
        }
      });
    }
    
  } catch (err) {
    logger.error('[/api/account-sets/test-connection] POST error', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      externalApiError: false
    });
  }
});

module.exports = router;