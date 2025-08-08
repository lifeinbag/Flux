const axios = require('axios');
const https = require('https');

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
  }

  getLatencyStats(brokerId, type) {
    const key = this.getCacheKey(brokerId, type);
    const data = this.cache.get(key);
    
    if (!data || data.records.length === 0) {
      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        count: 0
      };
    }
    
    const latencies = data.records.map(r => r.latency);
    const current = latencies[latencies.length - 1] || 0;
    const average = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    
    return {
      current: Math.round(current),
      average: Math.round(average),
      min: Math.round(min),
      max: Math.round(max),
      count: latencies.length
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