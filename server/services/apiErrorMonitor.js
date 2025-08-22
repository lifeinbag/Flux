const logger = require('../utils/logger');

class ApiErrorMonitor {
  constructor() {
    this.errorHistory = new Map(); // Store recent errors
    this.apiStatus = new Map(); // Track API status
    this.maxErrorHistory = 50; // Keep last 50 errors
    
    // Initialize API endpoints to monitor
    if (!process.env.MT4_API_URL || !process.env.MT5_API_URL) {
      throw new Error('Missing required environment variables: MT4_API_URL and MT5_API_URL must be set');
    }
    
    this.apiEndpoints = {
      'MT4_API': process.env.MT4_API_URL,
      'MT5_API': process.env.MT5_API_URL
    };
    
    // Initialize all APIs as unknown status
    Object.keys(this.apiEndpoints).forEach(api => {
      this.apiStatus.set(api, {
        status: 'unknown',
        lastCheck: null,
        lastError: null,
        errorCount: 0,
        uptime: 0
      });
    });
  }

  // Log API error and broadcast to clients
  logApiError(apiName, endpoint, error, context = {}) {
    const errorInfo = {
      id: Date.now() + Math.random(),
      apiName,
      endpoint,
      error: {
        message: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN',
        status: error.response?.status || null,
        statusText: error.response?.statusText || null,
        timeout: error.code === 'ECONNABORTED',
        cors: error.message?.includes('CORS') || error.message?.includes('Access-Control-Allow-Origin'),
        network: error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT'
      },
      context,
      timestamp: new Date(),
      severity: this.getErrorSeverity(error)
    };

    // Store in error history
    this.addToErrorHistory(errorInfo);
    
    // Update API status
    this.updateApiStatus(apiName, 'error', errorInfo);
    
    // Log to console
    logger.error(`🚨 External API Error [${apiName}]:`, {
      endpoint,
      error: error.message,
      code: error.code,
      status: error.response?.status,
      context
    });

    // Broadcast to WebSocket clients
    this.broadcastApiError(errorInfo);
    
    return errorInfo;
  }

  // Log successful API call
  logApiSuccess(apiName, endpoint, responseTime = null) {
    this.updateApiStatus(apiName, 'online', null, responseTime);
    
    // Only broadcast status changes (not every success)
    const status = this.apiStatus.get(apiName);
    if (status.status !== 'online') {
      this.broadcastApiStatus(apiName, status);
    }
  }

  // Get error severity based on error type
  getErrorSeverity(error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return 'critical'; // API completely down
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'high'; // Timeout issues
    } else if (error.response?.status >= 500) {
      return 'high'; // Server errors
    } else if (error.response?.status >= 400) {
      return 'medium'; // Client errors
    } else if (error.message?.includes('CORS')) {
      return 'high'; // CORS issues
    }
    return 'low';
  }

  // Add error to history with size limit
  addToErrorHistory(errorInfo) {
    const history = Array.from(this.errorHistory.values());
    history.push(errorInfo);
    
    // Keep only recent errors
    if (history.length > this.maxErrorHistory) {
      history.shift();
    }
    
    // Update map
    this.errorHistory.clear();
    history.forEach((error, index) => {
      this.errorHistory.set(error.id, error);
    });
  }

  // Update API status
  updateApiStatus(apiName, status, errorInfo = null, responseTime = null) {
    const currentStatus = this.apiStatus.get(apiName) || {};
    
    const updatedStatus = {
      ...currentStatus,
      status,
      lastCheck: new Date(),
      responseTime: responseTime || currentStatus.responseTime || null
    };
    
    if (status === 'error') {
      updatedStatus.lastError = errorInfo;
      updatedStatus.errorCount = (currentStatus.errorCount || 0) + 1;
      updatedStatus.uptime = 0;
    } else if (status === 'online') {
      updatedStatus.errorCount = 0;
      updatedStatus.uptime = (currentStatus.uptime || 0) + 1;
    }
    
    this.apiStatus.set(apiName, updatedStatus);
  }

  // Broadcast API error to WebSocket clients
  broadcastApiError(errorInfo) {
    try {
      const app = global.app;
      const broadcast = app?.locals?.broadcast;
      
      if (broadcast) {
        const message = {
          type: 'api_error',
          data: {
            ...errorInfo,
            // Add user-friendly error message
            userMessage: this.getUserFriendlyErrorMessage(errorInfo)
          }
        };
        
        broadcast(message);
        logger.info(`📡 Broadcasted API error: ${errorInfo.apiName} - ${errorInfo.error.message}`);
      }
    } catch (error) {
      logger.error('Failed to broadcast API error:', error);
    }
  }

  // Broadcast API status change
  broadcastApiStatus(apiName, status) {
    try {
      const app = global.app;
      const broadcast = app?.locals?.broadcast;
      
      if (broadcast) {
        const message = {
          type: 'api_status',
          data: {
            apiName,
            ...status,
            userMessage: this.getStatusMessage(apiName, status.status)
          }
        };
        
        broadcast(message);
      }
    } catch (error) {
      logger.error('Failed to broadcast API status:', error);
    }
  }

  // Get user-friendly error message
  getUserFriendlyErrorMessage(errorInfo) {
    const { error, apiName, context } = errorInfo;
    
    // Handle specific broker authentication errors
    if (context?.errorType === 'business_logic' && context?.brokerResponse) {
      return `${apiName} Broker Error: ${context.brokerResponse}. This is a broker server issue, not our application.`;
    }
    
    // Handle connection errors with detailed external error messages
    if (context?.errorMessage && typeof context.errorMessage === 'string') {
      if (context.errorMessage.includes('Failed to fetch')) {
        return `${apiName} Connection Failed: Cannot reach external API. Possible causes: CORS policy, Network issues, or API server down.`;
      } else if (context.errorMessage.includes('CORS')) {
        return `${apiName} CORS Error: ${context.errorMessage}. This is an external API configuration issue.`;
      } else {
        return `${apiName} External Error: ${context.errorMessage}. This is an external service issue.`;
      }
    }
    
    if (error.cors) {
      return `${apiName} API has CORS configuration issues. This is an external API problem.`;
    } else if (error.timeout) {
      return `${apiName} API is responding slowly or timing out. This may be temporary.`;
    } else if (error.network) {
      return `Cannot connect to ${apiName} API. The external service may be down.`;
    } else if (error.status >= 500) {
      return `${apiName} API is experiencing server errors (${error.status}). This is not an issue with our application.`;
    } else if (error.status >= 400) {
      const statusText = error.statusText || 'Unknown Error';
      const detailedMessage = context?.errorMessage ? ` - ${context.errorMessage}` : '';
      return `${apiName} API returned error (${error.status}): ${statusText}${detailedMessage}. This is an external API issue.`;
    } else {
      const detailedMessage = context?.errorMessage || error.message;
      return `${apiName} External API Error: ${detailedMessage}. Please check if the external service is working properly.`;
    }
  }

  // Get status message
  getStatusMessage(apiName, status) {
    switch (status) {
      case 'online':
        return `${apiName} API is working normally`;
      case 'online-auth-error':
        return `${apiName} API is online but has authentication issues (credentials may be invalid)`;
      case 'degraded':
        return `${apiName} API is online but experiencing some issues`;
      case 'error':
        return `${apiName} API is experiencing connection issues`;
      case 'offline':
        return `${apiName} API is offline`;
      default:
        return `${apiName} API status unknown`;
    }
  }

  // Get current API statuses
  getAllApiStatuses() {
    const statuses = {};
    this.apiStatus.forEach((status, apiName) => {
      statuses[apiName] = {
        ...status,
        userMessage: this.getStatusMessage(apiName, status.status)
      };
    });
    return statuses;
  }

  // Get recent errors
  getRecentErrors(limit = 10) {
    const errors = Array.from(this.errorHistory.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    
    return errors.map(error => ({
      ...error,
      userMessage: this.getUserFriendlyErrorMessage(error)
    }));
  }

  // Health check for all APIs
  async performHealthChecks() {
    const axios = require('axios');
    const results = {};
    
    for (const [apiName, endpoint] of Object.entries(this.apiEndpoints)) {
      try {
        const startTime = Date.now();
        
        // Simple health check - just check if API is reachable
        // Don't try to authenticate, just ping the base endpoint
        const response = await axios.get(endpoint, {
          timeout: 10000,
          headers: { 'User-Agent': 'FluxNetwork-HealthCheck' },
          validateStatus: function (status) {
            // Accept any response as "API is reachable"
            return status < 500; // Only treat 5xx as failures
          }
        });
        
        const responseTime = Date.now() - startTime;
        
        // Check if response indicates success (any response means API is reachable)
        let status = 'online';
        if (response.status >= 400 && response.status < 500) {
          // 4xx responses mean API is reachable but might have client-side issues
          status = 'online';
        }
        
        this.logApiSuccess(apiName, endpoint, responseTime);
        results[apiName] = { status, responseTime, lastResponse: response.data?.substring(0, 100) };
        
      } catch (error) {
        // Distinguish between connection errors and response errors
        let status = 'error';
        if (error.response && error.response.status < 500) {
          // 4xx errors mean API is reachable but request format issues
          status = 'online';
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          // Network errors mean API is unreachable
          status = 'offline';
        }
        
        // Only log as error if it's actually unreachable
        if (status !== 'online') {
          this.logApiError(apiName, endpoint, error, { type: 'health_check' });
        } else {
          this.logApiSuccess(apiName, endpoint);
        }
        results[apiName] = { status, error: error.message };
      }
    }
    
    return results;
  }

  // Start periodic health checks
  startHealthChecking(intervalMs = 30000) {
    logger.info('🏥 Starting API health monitoring...');
    
    // Initial check
    this.performHealthChecks();
    
    // Periodic checks
    setInterval(() => {
      this.performHealthChecks();
    }, intervalMs);
  }
}

// Create singleton instance
const apiErrorMonitor = new ApiErrorMonitor();

module.exports = apiErrorMonitor;