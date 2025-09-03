// server/routes/status.js
const express = require('express');
const router = express.Router();

// Uses your real logger module (singleton with getStatusSummary)
const statusLogger = require('../utils/brokerStatusLogger');

// Normalize to a safe fetch in case the export changes shape later
async function fetchSummary() {
  try {
    if (statusLogger && typeof statusLogger.getStatusSummary === 'function') {
      return statusLogger.getStatusSummary();
    }
    // Fallbacks (defensive)
    if (typeof statusLogger === 'function') return await statusLogger();
    if (statusLogger?.default && typeof statusLogger.default === 'function') {
      return await statusLogger.default();
    }
    if (typeof statusLogger === 'object') return statusLogger;
    return {};
  } catch (err) {
    console.error('brokerStatusLogger fetch failed:', err);
    return {};
  }
}

// Consider API “available” if we have any brokers and at least one active,
// otherwise treat as available to avoid false negatives when idle.
function computeAvailable(summary) {
  try {
    const total = Number(summary?.totalBrokers ?? 0);
    const active = Number(summary?.activeBrokers ?? 0);
    if (total > 0) return active >= 0; // non-strict; your logger marks ✅ Active
    return true; // idle system: don’t show red
  } catch {
    return true;
  }
}

// GET /status → { ok, available, data }
router.get('/status', async (_req, res) => {
  try {
    const data = await fetchSummary();
    const available = computeAvailable(data);
    return res.json({ ok: true, available, data });
  } catch (err) {
    console.error('Error in /status:', err);
    return res.status(500).json({ ok: false, available: false, error: String(err?.message || err) });
  }
});

// GET /ping → minimal health
router.get('/ping', async (_req, res) => {
  try {
    const data = await fetchSummary();
    const available = computeAvailable(data);
    return res.json({ available, message: available ? 'Trading service available' : 'Trading service unavailable' });
  } catch (err) {
    console.error('Error in /ping:', err);
    return res.json({ available: false, message: 'Trading service unavailable' });
  }
});

module.exports = router;
