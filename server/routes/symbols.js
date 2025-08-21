const router = require('express').Router();
const { sequelize } = require('../models');
const { AccountSet, Broker } = require('../models/AccountSet');
const auth = require('../middleware/auth');
const intelligentNormalizer = require('../utils/intelligentBrokerNormalizer');

/**
 * GET /api/symbols/cache?broker1=icmarkets&broker2=exness&terminal=MT4
 */
router.get('/cache', async (req, res) => {
  const broker1 = (req.query.broker1 || '').toLowerCase();
  const broker2 = (req.query.broker2 || '').toLowerCase();
  const terminal = (req.query.terminal || '').toUpperCase();

  if (!broker1 && !broker2) return res.status(400).json({ error: 'broker1_or_broker2_required' });
  if (!terminal) return res.status(400).json({ error: 'terminal_required' });

  try {
    const names = [broker1, broker2].filter(Boolean);
    const [rows] = await sequelize.query(
      `SELECT normalized_broker_name, symbols_data
       FROM broker_symbols_cache
       WHERE terminal = :terminal
         AND normalized_broker_name = ANY(:names)`,
      { replacements: { terminal, names } }
    );

    const out = { broker1: [], broker2: [], meta: { partial: false, source: 'cache' } };

    const parseSymbols = (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(x => {
        if (typeof x === 'string') return { symbol: x, display: x };
        if (typeof x === 'object' && x) {
          const sym = x.symbol || x.name || '';
          return { symbol: sym, display: x.display_symbol || sym };
        }
        return null;
      }).filter(Boolean);
    };

    for (const r of rows) {
      if (r.normalized_broker_name?.toLowerCase() === broker1) out.broker1 = parseSymbols(r.symbols_data);
      if (r.normalized_broker_name?.toLowerCase() === broker2) out.broker2 = parseSymbols(r.symbols_data);
    }

    if (broker1 && out.broker1.length === 0) out.meta.partial = true;
    if (broker2 && out.broker2.length === 0) out.meta.partial = true;

    return res.json(out);
  } catch (e) {
    console.error('symbols cache fetch error', e);
    return res.status(500).json({ error: 'FAILED_SYMBOL_CACHE_FETCH' });
  }
});

/**
 * GET /api/symbols/account-set/:accountSetId - Get symbols for specific account set
 */
router.get('/account-set/:accountSetId', auth, async (req, res) => {
  try {
    const { accountSetId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Find account set with brokers
    let whereClause = { id: accountSetId };
    if (!isAdmin) {
      whereClause.userId = userId;
    }

    const accountSet = await AccountSet.findOne({
      where: whereClause,
      include: [{
        model: Broker,
        as: 'brokers',
        separate: true,
        order: [['position', 'ASC']]
      }]
    });

    if (!accountSet || !accountSet.brokers || accountSet.brokers.length < 2) {
      return res.status(404).json({
        success: false,
        error: 'Account set not found or insufficient brokers'
      });
    }

    const broker1 = accountSet.brokers.find(b => b.position === 1) || accountSet.brokers[0];
    const broker2 = accountSet.brokers.find(b => b.position === 2) || accountSet.brokers[1];

    // Get normalized broker names for cache lookup
    const [normalizedBroker1, normalizedBroker2] = await Promise.all([
      intelligentNormalizer.normalizeBrokerName(broker1.brokerName, broker1.server, broker1.companyName),
      intelligentNormalizer.normalizeBrokerName(broker2.brokerName, broker2.server, broker2.companyName)
    ]);

    // Query symbols from cache for both brokers
    const [rows] = await sequelize.query(
      `SELECT normalized_broker_name, terminal, symbols_data, last_updated
       FROM broker_symbols_cache
       WHERE (normalized_broker_name = :broker1 AND terminal = :terminal1)
          OR (normalized_broker_name = :broker2 AND terminal = :terminal2)
       ORDER BY last_updated DESC`,
      {
        replacements: {
          broker1: normalizedBroker1,
          terminal1: broker1.terminal,
          broker2: normalizedBroker2,
          terminal2: broker2.terminal
        }
      }
    );

    const result = {
      success: true,
      accountSetId,
      broker1Symbols: [],
      broker2Symbols: [],
      meta: {
        source: 'cache',
        brokers: {
          broker1: {
            name: broker1.brokerName,
            terminal: broker1.terminal,
            normalized: normalizedBroker1
          },
          broker2: {
            name: broker2.brokerName,
            terminal: broker2.terminal,
            normalized: normalizedBroker2
          }
        }
      }
    };

    const parseSymbols = (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(x => {
        if (typeof x === 'string') return x;
        if (typeof x === 'object' && x) {
          return x.symbol || x.name || x.currency || x.display_symbol || '';
        }
        return '';
      }).filter(Boolean);
    };

    for (const row of rows) {
      const symbols = parseSymbols(row.symbols_data);
      
      if (row.normalized_broker_name === normalizedBroker1 && row.terminal === broker1.terminal) {
        result.broker1Symbols = symbols;
      }
      if (row.normalized_broker_name === normalizedBroker2 && row.terminal === broker2.terminal) {
        result.broker2Symbols = symbols;
      }
    }

    return res.json(result);
  } catch (error) {
    console.error('Account set symbols fetch error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch symbols for account set'
    });
  }
});

module.exports = router;
