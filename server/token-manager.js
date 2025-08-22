require('dotenv').config();
const axios = require('axios');
const apiErrorMonitor = require('./services/apiErrorMonitor');

class TokenError extends Error {}

class AtomicLock {
  constructor() {
    this.queues = new Map();
  }

  acquire(key) {
    if (!this.queues.has(key)) {
      this.queues.set(key, []);
      return Promise.resolve(() => this._release(key));
    }
    return new Promise(resolve => {
      this.queues.get(key).push(resolve);
    });
  }

  _release(key) {
    const q = this.queues.get(key);
    if (!q) return;
    if (q.length > 0) {
      const next = q.shift();
      next(() => this._release(key));
    } else {
      this.queues.delete(key);
    }
  }
}

const TOKEN_TTL_MS = 22 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
const CONNECTION_POOL_SIZE = 3;

const TokenManager = {
  cache: new Map(),
  lock: new AtomicLock(),
  connectionPools: new Map(),
  tokenTTL: TOKEN_TTL_MS,

  init() {
    setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
  },

  _cleanup() {
    const now = Date.now();
    for (const [key, slot] of this.cache.entries()) {
      if (now - slot.lastFetch > TOKEN_TTL_MS * 1.5) {
        this.cache.delete(key);
      }
    }
  },

  // ✅ ENHANCED: Connection pooling for better performance
  _getClient(isMT5) {
    const baseURL = isMT5 ? process.env.MT5_API_URL : process.env.MT4_API_URL;
    if (!baseURL) {
      throw new TokenError(`Missing API URL for ${isMT5 ? 'MT5' : 'MT4'}`);
    }
    
    const poolKey = `${isMT5 ? 'MT5' : 'MT4'}_pool`;
    
    if (!this.connectionPools.has(poolKey)) {
      this.connectionPools.set(poolKey, {
        clients: [],
        currentIndex: 0
      });
      
      // Create connection pool
      for (let i = 0; i < CONNECTION_POOL_SIZE; i++) {
        const client = axios.create({
          baseURL,
          timeout: 30000,
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false,
            keepAlive: true,
            maxSockets: 10,
            timeout: 30000
          })
        });
        this.connectionPools.get(poolKey).clients.push(client);
      }
    }
    
    // Round-robin client selection
    const pool = this.connectionPools.get(poolKey);
    const client = pool.clients[pool.currentIndex];
    pool.currentIndex = (pool.currentIndex + 1) % CONNECTION_POOL_SIZE;
    
    return client;
  },
  
  getConfig(isMT5) {
    return { client: this._getClient(isMT5) };
  },
  
  invalidateToken(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
  },

  _generateKey(isMT5, serverName, account, brokerId, position = 1) {
    return `${isMT5 ? 'MT5' : 'MT4'}|${serverName}|${account}|${brokerId || 'default'}|pos${position}`;
  },

  // ✅ REMOVED: Unnecessary API health check
  // Health status is now tracked through actual operational success/failures
  // via brokerStatusLogger.logSuccess() calls during real token operations

  async getToken(isMT5, serverName, account, password, brokerId = null, position = 1) {
    if (!serverName || !account || !password) {
      throw new TokenError('Missing credentials');
    }
    
    const key = this._generateKey(isMT5, serverName, account, brokerId, position);
    
    // ✅ ENHANCED: Better cache validation with error handling
    if (this.cache.has(key)) {
      const slot = this.cache.get(key);
      const tokenAge = Date.now() - slot.lastFetch;
      
      // Use very recent tokens without validation (< 1 hour)
      if (tokenAge < 3600000) {
        console.log(`✅ Using fresh cached token for ${serverName}|${account} (age: ${Math.floor(tokenAge/60000)}min)`);
        return slot.token;
      }
      
      // For tokens 1-6 hours old, skip validation to reduce API load
      if (tokenAge < this.tokenTTL) {
        // Validate tokens older than 6 hours but within TTL
        if (tokenAge > 21600000) {
          try {
            const isValid = await this._validateToken(this._getClient(isMT5), slot.token);
            if (isValid) {
              console.log(`✅ Validated cached token for ${serverName}|${account}`);
              return slot.token;
            } else {
              console.log(`❌ Token validation failed for ${serverName}|${account}, will refresh`);
              this.cache.delete(key);
            }
          } catch (validationError) {
            console.log(`⚠ Token validation error for ${serverName}|${account}:`, validationError.message);
            // Continue to fetch new token if validation fails
            this.cache.delete(key);
          }
        } else {
          console.log(`✅ Using cached token (skip validation) for ${serverName}|${account} (age: ${Math.floor(tokenAge/3600000)}h)`);
          return slot.token;
        }
      } else {
        // Token is expired, remove from cache
        console.log(`🗑 Removing expired token for ${serverName}|${account} (age: ${Math.floor(tokenAge/3600000)}h)`);
        this.cache.delete(key);
      }
    }

    // ✅ REMOVED: Unnecessary API health check before token fetch
    // Real API health is determined during actual token connection attempts
    const client = this._getClient(isMT5);

    // Fetch new token under lock
    const release = await this.lock.acquire(key);
    try {
      const result = await this._fetchTokenSimplified(client, serverName, account, password);
      this.cache.set(key, {
        token: result.token,
        hostPort: result.hostPort,
        lastFetch: Date.now()
      });
      console.log(`✅ New token cached for ${serverName}|${account}`);
      return result.token;
    } finally {
      release();
    }
  },

  async getHostAndPort(isMT5, serverName, account, password, brokerId = null, position = 1) {
    const key = this._generateKey(isMT5, serverName, account, brokerId, position);
    const slot = this.cache.get(key);
    
    if (slot?.hostPort) {
      return slot.hostPort;
    }
    
    const baseURL = isMT5 ? process.env.MT5_API_URL : process.env.MT4_API_URL;
    const url = new URL(baseURL);
    return { host: url.hostname, port: url.port || 443 };
  },

  // ✅ FIXED: Enhanced token validation
  async _validateToken(client, token) {
    if (!token || token.length < 10) return false;
    
    try {
      const response = await client.get('/CheckConnect', { 
        params: { id: token },
        timeout: 8000 // ✅ FIXED: Reduced timeout for validation
      });
      return response.status === 200 && response.data === 'OK';
    } catch (error) {
      console.log(`Token validation failed: ${error.message}`);
      return false;
    }
  },

  // ✅ FIXED: Enhanced token fetching with optimized ConnectEx-first flow
  async _fetchTokenSimplified(client, serverName, account, password) {
    console.log(`🔄 Fetching token for ${serverName} account ${account}...`);
    
    // Method 1: Try ConnectEx directly first (no search needed)
    const apiName = client.defaults.baseURL?.includes('mt5') ? 'MT5_API' : 'MT4_API';
    const endpoint = `${client.defaults.baseURL}/ConnectEx`;
    
    try {
      console.log(`📡 Trying ConnectEx directly for ${serverName}...`);
      const startTime = Date.now();
      const connectResponse = await client.get('/ConnectEx', {
        params: {
          user: account,
          password: password,
          server: serverName
        },
        timeout: 20000
      });
      
      // Log successful API call
      const responseTime = Date.now() - startTime;
      apiErrorMonitor.logApiSuccess(apiName, endpoint, responseTime);
      
      // ✅ Validate response
      if (connectResponse.data && typeof connectResponse.data === 'string') {
        const data = connectResponse.data.trim();
        
        if (data.includes('[error]') || 
            data.includes('Resource temporarily unavailable') ||
            data.includes('Invalid account') ||
            data.includes('Wrong password')) {
          
          // Log API business logic error (not connection error)
          const businessError = new Error(`Broker server error: ${data}`);
          apiErrorMonitor.logApiError(apiName, endpoint, businessError, {
            context: 'broker_authentication',
            serverName,
            account: account?.substring(0, 4) + '***',
            errorType: 'business_logic',
            brokerResponse: data
          });
          
          throw businessError;
        }
        
        if (data.length > 10 && !data.includes('error')) {
          console.log(`✅ ConnectEx successful for ${serverName}`);
          return {
            token: data,
            hostPort: null // ConnectEx doesn't provide specific host:port
          };
        }
      }
      
      const emptyResponseError = new Error('Invalid or empty response from ConnectEx');
      apiErrorMonitor.logApiError(apiName, endpoint, emptyResponseError, {
        context: 'empty_response',
        serverName,
        account: account?.substring(0, 4) + '***',
        responseData: connectResponse.data
      });
      
      throw emptyResponseError;
      
    } catch (connectExError) {
      console.log(`⚠️ ConnectEx failed for ${serverName}: ${connectExError.message}`);
      
      // Log API error with detailed context
      if (!connectExError.logged) { // Avoid double logging
        apiErrorMonitor.logApiError(apiName, endpoint, connectExError, {
          context: 'connection_attempt',
          serverName,
          account: account?.substring(0, 4) + '***',
          errorCode: connectExError.code,
          errorStatus: connectExError.response?.status,
          errorMessage: connectExError.response?.data || connectExError.message
        });
        connectExError.logged = true;
      }
      
      // Don't try fallback on authentication errors
      if (connectExError.message.includes('Invalid account') || 
          connectExError.message.includes('Wrong password')) {
        throw new TokenError(`Authentication failed: ${connectExError.message}`);
      }
    }
    
    // Method 2: Fallback to search and connect (legacy method)
    try {
      console.log(`🔍 Fallback: Searching for access points for ${serverName}...`);
      const searchResponse = await client.get('/Search', {
        params: { company: serverName },
        timeout: 15000
      });
      
      const searchData = searchResponse.data;
      if (!Array.isArray(searchData) || searchData.length === 0) {
        throw new Error(`No broker data found for ${serverName}`);
      }

      const accessPoints = this._extractAccessPointsSimplified(searchData, serverName);
      
      if (accessPoints.length > 0) {
        // Try each access point with retry logic
        for (const accessPoint of accessPoints.slice(0, 3)) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const [host, port = '443'] = accessPoint.split(':');
              console.log(`📡 Trying Connect to ${host}:${port} (attempt ${attempt})...`);
              
              const connectResponse = await client.get('/Connect', {
                params: {
                  user: account,
                  password: password,
                  host: host.trim(),
                  port: port.trim()
                },
                timeout: 20000
              });
              
              // ✅ Validate response
              if (connectResponse.data && typeof connectResponse.data === 'string') {
                const data = connectResponse.data.trim();
                
                if (data.includes('[error]') || 
                    data.includes('Resource temporarily unavailable') ||
                    data.includes('Invalid account') ||
                    data.includes('Wrong password')) {
                  throw new Error(`Broker server error: ${data}`);
                }
                
                if (data.length > 10 && !data.includes('error')) {
                  console.log(`✅ Connect successful to ${host}:${port}`);
                  return {
                    token: data,
                    hostPort: { host: host.trim(), port: Number(port.trim()) || 443 }
                  };
                }
              }
              
              throw new Error('Invalid or empty response from Connect');
              
            } catch (connectError) {
              console.log(`⚠️ Failed to connect to ${accessPoint} (attempt ${attempt}): ${connectError.message}`);
              
              // Don't retry on authentication errors
              if (connectError.message.includes('Invalid account') || 
                  connectError.message.includes('Wrong password')) {
                break;
              }
              
              // Wait before retry (except on last attempt)
              if (attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }
        }
      }
    } catch (searchError) {
      console.log(`⚠️ Search fallback method failed for ${serverName}: ${searchError.message}`);
    }

    // ✅ Both methods failed
    throw new TokenError(
      `Failed to connect to ${serverName} using both ConnectEx and Connect methods. Please check:\n` +
      `• Server name: "${serverName}" is correct\n` +
      `• Account ${account} credentials are valid\n` +
      `• Broker server is online and accessible\n` +
      `• Network connectivity is stable\n` +
      `• Try again in a few minutes if server is busy`
    );
  },

  _extractAccessPointsSimplified(searchData, serverName) {
    const accessPoints = [];
    
    try {
      for (const company of searchData) {
        if (company.name === serverName && Array.isArray(company.access)) {
          accessPoints.push(...company.access);
        }
        
        if (Array.isArray(company.results)) {
          const server = company.results.find(r => r.name === serverName);
          if (server && Array.isArray(server.access)) {
            accessPoints.push(...server.access);
          }
        }
      }
      
      console.log(`🔍 Found ${accessPoints.length} access points for ${serverName}:`, accessPoints);
      return accessPoints;
      
    } catch (error) {
      console.log(`⚠️ Error extracting access points: ${error.message}`);
      return [];
    }
  },

  async _fetchTokenWithHost(client, serverName, account, password) {
    return await this._fetchTokenSimplified(client, serverName, account, password);
  },

  _extractHosts(searchData, serverName) {
    const accessPoints = this._extractAccessPointsSimplified(searchData, serverName);
    return accessPoints.map(ap => {
      const [h, p] = ap.split(':').map(s => s.trim());
      return { host: h, port: Number(p) || 443 };
    });
  },
};

TokenManager.init();
module.exports = { TokenManager, TokenError };
