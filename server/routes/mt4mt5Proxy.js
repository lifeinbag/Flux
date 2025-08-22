const express = require('express');
const axios = require('axios');
const router = express.Router();

// Get API URLs from environment variables
const MT5_API_URL = process.env.MT5_API_URL;
const MT4_API_URL = process.env.MT4_API_URL;

if (!MT5_API_URL || !MT4_API_URL) {
  throw new Error('Missing required environment variables: MT4_API_URL and MT5_API_URL must be set');
}

// MT5 proxy endpoint
router.get('/mt5/opened-orders', async (req, res) => {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID parameter is required'
      });
    }

    const response = await axios.get(`${MT5_API_URL}/OpenedOrders?id=${id}`, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FluxNetwork-Proxy/1.0'
      }
    });

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('MT5 API Error:', error.message);
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || 'Failed to fetch MT5 data',
      message: error.message
    });
  }
});

// MT4 proxy endpoint
router.get('/mt4/opened-orders', async (req, res) => {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID parameter is required'
      });
    }

    const response = await axios.get(`${MT4_API_URL}/OpenedOrders?id=${id}`, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FluxNetwork-Proxy/1.0'
      }
    });

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('MT4 API Error:', error.message);
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || 'Failed to fetch MT4 data',
      message: error.message
    });
  }
});

// Combined endpoint for both MT4 and MT5
router.get('/combined/opened-orders', async (req, res) => {
  try {
    const { mt5Id, mt4Id } = req.query;
    
    if (!mt5Id || !mt4Id) {
      return res.status(400).json({
        success: false,
        error: 'Both mt5Id and mt4Id parameters are required'
      });
    }

    // Fetch both MT4 and MT5 data in parallel
    const [mt5Response, mt4Response] = await Promise.allSettled([
      axios.get(`${MT5_API_URL}/OpenedOrders?id=${mt5Id}`, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FluxNetwork-Proxy/1.0'
        }
      }),
      axios.get(`${MT4_API_URL}/OpenedOrders?id=${mt4Id}`, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FluxNetwork-Proxy/1.0'
        }
      })
    ]);

    const result = {
      success: true,
      data: {
        mt5: mt5Response.status === 'fulfilled' ? mt5Response.value.data : null,
        mt4: mt4Response.status === 'fulfilled' ? mt4Response.value.data : null
      },
      errors: {
        mt5: mt5Response.status === 'rejected' ? mt5Response.reason.message : null,
        mt4: mt4Response.status === 'rejected' ? mt4Response.reason.message : null
      }
    };

    res.json(result);

  } catch (error) {
    console.error('Combined API Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch combined data',
      message: error.message
    });
  }
});

module.exports = router;