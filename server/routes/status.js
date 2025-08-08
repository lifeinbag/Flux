// server/routes/status.js
const express = require('express');
const axios   = require('axios');
const router  = express.Router();

/**
 * Try pinging MT4 and MT5 APIs by calling /Connect with dummy params.
 * If we get any HTTP response (200, 400, etc.) then the API is reachable.
 */
async function checkTradingApi() {
  const clients = [];
  if (process.env.MT4_API_URL) clients.push(
    axios.create({ baseURL: process.env.MT4_API_URL, timeout: 10000 })
  );
  if (process.env.MT5_API_URL) clients.push(
    axios.create({ baseURL: process.env.MT5_API_URL, timeout: 10000 })
  );

  for (const client of clients) {
    try {
      // Test with dummy credentials for ConnectEx
      await client.get('/ConnectEx', {
        params: { user: '0', password: '0', server: 'test' }
      });
      return true;
    } catch (err) {
      if (err.response) {
        // Got a response (likely 400), so API is up
        return true;
      }
      // Network/timeout error: try next client
    }
  }

  return false;
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