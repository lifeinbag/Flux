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
 *   - days:         look-back days (default 90)
 *   - limit:        max bars (default 10000)
 */
router.get('/premium-candles', async (req, res) => {
  try {
    const { tf, accountSetId, days = 90, limit = 10000 } = req.query;
    if (!tf || !accountSetId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing tf or accountSetId' });
    }

    // Convert to numbers
    const minutes  = Number(tf);
    const lookback = Number(days);
    const maxBars  = Number(limit);

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

    // 2️⃣ Bucket into epoch-based intervals
    //    floor(epoch/tf*60)*tf*60 groups timestamp into tf-minute windows
    const sql = `
      WITH buckets AS (
        SELECT
          sell_premium,
          "timestamp",
          floor(extract(epoch FROM "timestamp") / (:tf * 60)) * (:tf * 60) AS bucket
        FROM "${tableName}"
        WHERE "timestamp" > now() - (:lookback || ' days')::interval
      )
      SELECT
        bucket                                    AS time,
        (array_agg(sell_premium ORDER BY "timestamp"))[1]      AS open,
        MAX(sell_premium)                         AS high,
        MIN(sell_premium)                         AS low,
        (array_agg(sell_premium ORDER BY "timestamp" DESC))[1] AS close
      FROM buckets
      GROUP BY bucket
      ORDER BY bucket
      LIMIT :limit;
    `;

    const bars = await sequelize.query(sql, {
      replacements: {
        tf: minutes,
        lookback,
        limit: maxBars
      },
      type: QueryTypes.SELECT
    });

    console.log(`📊 Found ${bars.length} premium candles from shared table ${tableName} (${days} days, ${tf}m timeframe)`);
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
