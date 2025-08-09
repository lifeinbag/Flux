const axios = require('axios');
const https = require('https');
const { sequelize } = require('../models');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 30000
});

class LatencyMonitor {
  constructor() {
    this.cache = new Map();
    this.CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), this.CACHE_DURATION);
    this.initializeDatabase();
  }

  async initializeDatabase() {
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS broker_latency (
          id SERIAL PRIMARY KEY,
          broker_id UUID NOT NULL,
          latency_type VARCHAR(20) NOT NULL,
          latency_ms INTEGER NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          date DATE DEFAULT CURRENT_DATE
        )
      `);

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_broker_latency_broker_type_date 
        ON broker_latency (broker_id, latency_type, date)
      `);

      console.log('✅ Latency monitoring database initialized');
    } catch (err) {
      console.error('Failed to initialize latency database:', err.message);
    }
  }

  getCacheKey(brokerId, type) {
    return `${brokerId}-${type}`;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.cache.entries()) {
      if (now - data.lastCleanup > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }

  addLatencyRecord(brokerId, type, latency) {
    const key = this.getCacheKey(brokerId, type);
    const now = Date.now();
    
    if (!this.cache.has(key)) {
      this.cache.set(key, {
        records: [],
        lastCleanup: now
      });
    }
    
    const data = this.cache.get(key);
    
    // Add new record
    data.records.push({ latency, timestamp: now });
    
    // Remove records older than 15 minutes
    data.records = data.records.filter(record => 
      now - record.timestamp <= this.CACHE_DURATION
    );
    
    data.lastCleanup = now;
    
    // Save to database for persistence and daily averages
    this.saveLatencyToDatabase(brokerId, type, latency).catch(err => {
      console.error('Failed to save latency to database:', err.message);
    });
  }

  async saveLatencyToDatabase(brokerId, type, latency) {
    try {
      await sequelize.query(`
        INSERT INTO broker_latency (broker_id, latency_type, latency_ms)
        VALUES (:brokerId, :type, :latency)
      `, {
        replacements: { brokerId, type, latency }
      });
    } catch (err) {
      console.error('Error saving latency to database:', err.message);
    }
  }

  async getLatencyStats(brokerId, type) {
    // Get current from in-memory cache
    const key = this.getCacheKey(brokerId, type);
    const data = this.cache.get(key);
    let current = 0;
    
    if (data && data.records.length > 0) {
      current = data.records[data.records.length - 1].latency;
    } else {
      // Fallback: get most recent from database
      try {
        const [results] = await sequelize.query(`
          SELECT latency_ms FROM broker_latency 
          WHERE broker_id = :brokerId AND latency_type = :type 
          ORDER BY timestamp DESC LIMIT 1
        `, {
          replacements: { brokerId, type }
        });
        
        if (results.length > 0) {
          current = results[0].latency_ms;
        }
      } catch (err) {
        console.error('Error getting current latency from database:', err.message);
      }
    }
    
    // Get daily average from database
    let average = 0;
    try {
      const [results] = await sequelize.query(`
        SELECT AVG(latency_ms)::INTEGER as avg_latency 
        FROM broker_latency 
        WHERE broker_id = :brokerId AND latency_type = :type 
          AND date = CURRENT_DATE
      `, {
        replacements: { brokerId, type }
      });
      
      if (results.length > 0 && results[0].avg_latency) {
        average = results[0].avg_latency;
      }
    } catch (err) {
      console.error('Error getting daily average latency:', err.message);
    }
    
    return {
      current: Math.round(current),
      average: Math.round(average),
      count: data ? data.records.length : 0
    };
  }

  async measureOrderSendLatency(url, params = {}) {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(url, {
        params,
        timeout: 10000,
        httpsAgent
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      return {
        success: true,
        latency,
        response: response.data
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      return {
        success: false,
        latency,
        error: error.message
      };
    }
  }

  async measureQuotePing(terminal, brokerId, symbol, token) {
    const baseUrl = terminal === 'MT5' ? 
      process.env.MT5_API_URL : 
      process.env.MT4_API_URL;
    
    const url = `${baseUrl}/GetQuote`;
    const params = { id: token, symbol };
    
    const startTime = Date.now();
    
    try {
      const response = await axios.get(url, {
        params,
        timeout: 5000,
        httpsAgent
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      return {
        success: true,
        latency,
        bid: response.data.bid,
        ask: response.data.ask
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      return {
        success: false,
        latency,
        error: error.message
      };
    }
  }

  async testOrderSendEndpoint(terminal, brokerId, params = {}) {
    const baseUrl = terminal === 'MT5' ? 
      process.env.MT5_API_URL : 
      process.env.MT4_API_URL;
    
    const url = `${baseUrl}/OrderSend`;
    
    // Use test parameters to avoid actual order execution
    const testParams = {
      id: params.id || 'test-token',
      symbol: params.symbol || 'EURUSD',
      operation: params.operation || 'Buy',
      volume: params.volume || '0.01',
      ...params
    };
    
    return await this.measureOrderSendLatency(url, testParams);
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = new LatencyMonitor();