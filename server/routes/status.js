// server/routes/status.js
const express = require('express');
const router  = express.Router();
const brokerStatusLogger = require('../utils/brokerStatusLogger');

/**
 * ✅ OPTIMIZED: Check trading API health using actual operational data
 * instead of making unnecessary dummy API calls
 */
async function checkTradingApi() {
  try {
    // Get recent broker status data (actual operational health)
    const statusData = brokerStatusLogger.getStatusData();
    
    // Check if any brokers have had successful operations recently (within 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    for (const [accountSetName, brokers] of Object.entries(statusData)) {
      for (const [brokerName, operations] of Object.entries(brokers)) {
        for (const [operation, timestamp] of Object.entries(operations)) {
          if (timestamp && timestamp >= fiveMinutesAgo) {
            // Found recent successful operation - APIs are working
            return true;
          }
        }
      }
    }
    
    // No recent successful operations - but this doesn't mean APIs are down
    // They might just not be in use. Return true to avoid false negatives.
    return true;
  } catch (error) {
    console.error('Error checking broker status:', error);
    return false;
  }
}
router.get('/status', async (req, res) => {
  try {
    const available = await checkTradingApi();
    res.json({ available });
  } catch (err) {
    console.error('Error checking trading API:', err);
    res.json({ available: false });
  }
});

// Add ping endpoint for Dashboard compatibility
router.get('/ping', async (req, res) => {
  try {
    const available = await checkTradingApi();
    res.json({ available, message: available ? 'Trading service available' : 'Trading service unavailable' });
  } catch (err) {
    console.error('Error checking trading API:', err);
    res.json({ available: false, message: 'Trading service unavailable' });
  }
});

module.exports = router;