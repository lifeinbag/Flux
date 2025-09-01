// server/routes/premium.js
const express       = require('express');
const router        = express.Router();
const sequelize     = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * GET /api/premium-candles
 * Query params:
 *   - tf:           timeframe in minutes (1,5,15,60,1440,…)
 *   - accountSetId: UUID of the AccountSet
 *   - days:         look-back days (optional - if not provided, returns ALL data)
 *   - limit:        max bars (optional - if not provided, no limit)
 */
router.get('/premium-candles', async (req, res) => {
  try {
    const { tf, accountSetId, days = null, limit = null } = req.query;
    if (!tf || !accountSetId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing tf or accountSetId' });
    }

    // Convert to numbers with defaults
    const minutes  = Number(tf);
    const lookback = days ? Number(days) : null;
    const maxBars  = limit ? Number(limit) : 50000; // Default max 50k bars for performance

    // 1️⃣ Lookup which table holds this set’s data
    const tableRows = await sequelize.query(
      `SELECT "premiumTableName" 
         FROM "account_sets" 
        WHERE id = :id`,
      {
        replacements: { id: accountSetId },
        type: QueryTypes.SELECT
      }
    );
    if (!tableRows.length || !tableRows[0].premiumTableName) {
      return res
        .status(404)
        .json({ success: false, error: 'No premiumTableName configured' });
    }
    const tableName = tableRows[0].premiumTableName;
    console.log(`✅ Using shared premium table: ${tableName} for AccountSet: ${accountSetId}`);

    // 2️⃣ Bucket into epoch-based intervals - support ALL data or filtered
    //    floor(epoch/tf*60)*tf*60 groups timestamp into tf-minute windows
    let whereClause = '';
    let limitClause = '';
    
    if (lookback) {
      whereClause = `WHERE "timestamp" > now() - (:lookback || ' days')::interval`;
    }
    
    // Always apply limit for performance (either user-specified or default)
    limitClause = 'LIMIT :limit';
    
    const sql = `
      WITH buckets AS (
        SELECT
          sell_premium,
          buy_premium,
          "timestamp",
          floor(extract(epoch FROM "timestamp") / (:tf * 60)) * (:tf * 60) AS bucket
        FROM "${tableName}"
        ${whereClause}
      )
      SELECT
        bucket                                    AS time,
        (array_agg(sell_premium ORDER BY "timestamp"))[1]      AS open,
        MAX(sell_premium)                         AS high,
        MIN(sell_premium)                         AS low,
        (array_agg(sell_premium ORDER BY "timestamp" DESC))[1] AS close,
        COUNT(*)                                  AS volume,
        AVG(buy_premium)                         AS buy_premium_avg,
        AVG(sell_premium)                        AS sell_premium_avg
      FROM buckets
      GROUP BY bucket
      ORDER BY bucket
      ${limitClause};
    `;

    const replacements = { tf: minutes, limit: maxBars };
    if (lookback) replacements.lookback = lookback;

    const bars = await sequelize.query(sql, {
      replacements,
      type: QueryTypes.SELECT
    });

    const dataDescription = lookback ? `${lookback} days` : 'ALL historical data';
    const limitDescription = limit ? `, limited to ${limit} bars` : `, limited to ${maxBars} bars (default)`;
    console.log(`📊 Found ${bars.length} premium candles from shared table ${tableName} (${dataDescription}, ${tf}m timeframe${limitDescription})`);
    return res.json({ success: true, data: bars });
  } catch (err) {
    console.error('[/api/premium-candles] ERROR:', err);
    return res
      .status(500)
      .json({ success: false, error: err.message });
  }
});

/**
 * GET /api/premium-candles/latest
 * Query params:
 *   - accountSetId: UUID of the AccountSet
 *
 * Returns the single most recent sell_premium tick.
 */
router.get('/premium-candles/latest', async (req, res) => {
  try {
    const { accountSetId } = req.query;
    if (!accountSetId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing accountSetId' });
    }

    // Lookup table name
    const tableRows = await sequelize.query(
      `SELECT "premiumTableName" 
         FROM "account_sets" 
        WHERE id = :id`,
      {
        replacements: { id: accountSetId },
        type: QueryTypes.SELECT
      }
    );
    if (!tableRows.length || !tableRows[0].premiumTableName) {
      return res
        .status(404)
        .json({ success: false, error: 'No premiumTableName configured' });
    }
    const tableName = tableRows[0].premiumTableName;
    console.log(`✅ Using shared premium table for latest data: ${tableName} for AccountSet: ${accountSetId}`);

    // Fetch latest tick
    const latestSql = `
      SELECT
        extract(epoch FROM "timestamp")::int AS time,
        sell_premium                         AS sellPremium,
        '${accountSetId}'                    AS accountSetId
      FROM "${tableName}"
      ORDER BY "timestamp" DESC
      LIMIT 1;
    `;
    const latestRows = await sequelize.query(latestSql, {
      type: QueryTypes.SELECT
    });

    return res.json({
      success: true,
      data: latestRows[0] || null
    });
  } catch (err) {
    console.error('[/api/premium-candles/latest] ERROR:', err);
    return res
      .status(500)
      .json({ success: false, error: err.message });
  }
});

module.exports = router;
