// server/utils/logger.js
const winston = require('winston');
const fs = require('fs');
const path = require('path');

const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Custom format that outputs exactly like console.log for files
const consoleFormat = winston.format.printf(({ level, message, timestamp }) => {
  return message; // Just return the raw message, no timestamps or level prefixes for console-like output
});

const logger = winston.createLogger({
  level,
  transports: [
    // Console output (keep original format)
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    // File output - make it look exactly like console output
    new winston.transports.File({
      filename: 'logs/server.log',
      level: 'debug',
      format: consoleFormat
    })
  ]
});

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

// Intercept console.log and friends to also write to files
console.log = function(...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  // Call original console.log for terminal output
  originalConsole.log(...args);
  
  // Also log to files with exact same message
  logger.info(message);
};

console.error = function(...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  originalConsole.error(...args);
  logger.error(message);
};

console.warn = function(...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  originalConsole.warn(...args);
  logger.warn(message);
};

console.info = function(...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  originalConsole.info(...args);
  logger.info(message);
};

console.debug = function(...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  originalConsole.debug(...args);
  logger.debug(message);
};

class Logger {
  constructor() {
    this.winston = logger;
    // Keep premium_system.log for backward compatibility but it's mostly unused now
    this.logFile = path.join(__dirname, '..', 'premium_system.log');
    this.orderExecutionLogFile = path.join(__dirname, '..', 'logs', 'order-execution.log');
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.ensureLogFile();
    this.ensureOrderExecutionLogFile();
  }

  ensureLogFile() {
    try {
      if (!fs.existsSync(this.logFile)) {
        fs.writeFileSync(this.logFile, '');
      }
    } catch (err) {
      console.error('Failed to create log file:', err);
    }
  }

  ensureOrderExecutionLogFile() {
    try {
      const logDir = path.dirname(this.orderExecutionLogFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      if (!fs.existsSync(this.orderExecutionLogFile)) {
        fs.writeFileSync(this.orderExecutionLogFile, '');
      }
    } catch (err) {
      console.error('Failed to create order execution log file:', err);
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, data = null) {
    const timestamp = this.getTimestamp();
    let logEntry = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        // Safely handle error objects to avoid circular references
        const safeData = data.message || data.error || data.code || 'Object details logged';
        logEntry += `\nData: ${safeData}`;
      } else {
        logEntry += `\nData: ${data}`;
      }
    }
    
    return logEntry + '\n';
  }

  writeToFile(message) {
    try {
      // Check file size and rotate if needed
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxFileSize) {
          const backupFile = this.logFile.replace('.log', '_backup.log');
          fs.renameSync(this.logFile, backupFile);
        }
      }

      fs.appendFileSync(this.logFile, message);
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  log(level, message, data = null) {
    const formattedMessage = this.formatMessage(level, message, data);
    
    // Write to console with colors (safely handle error objects)
    const safeData = data && typeof data === 'object' && data.message ? data.message : (data || '');
    switch (level) {
      case 'ERROR':
        console.error(`❌ ${message}`, safeData);
        break;
      case 'WARN':
        console.warn(`⚠️ ${message}`, safeData);
        break;
      case 'SUCCESS':
        console.log(`✅ ${message}`, data || '');
        break;
      case 'INFO':
        console.log(`📊 ${message}`, data || '');
        break;
      default:
        console.log(`🔄 ${message}`, data || '');
    }

    // Write to file
    this.writeToFile(formattedMessage);
  }

  error(message, data = null) {
    const safeData = data && typeof data === 'object' && data.message ? data.message : data;
    this.winston.error(message, safeData);
    this.writeToFile(this.formatMessage('ERROR', message, safeData));
  }

  warn(message, data = null) {
    const safeData = data && typeof data === 'object' && data.message ? data.message : data;
    this.winston.warn(message, safeData);
    this.writeToFile(this.formatMessage('WARN', message, safeData));
  }

  success(message, data = null) {
    this.log('SUCCESS', message, data);
  }

  info(message, data = null) {
    this.winston.info(message, data);
    this.writeToFile(this.formatMessage('INFO', message, data));
  }

  debug(message, data = null) {
    this.winston.debug(message, data);
    this.writeToFile(this.formatMessage('DEBUG', message, data));
  }

  silly(message, data = null) {
    this.winston.silly(message, data);
    this.writeToFile(this.formatMessage('SILLY', message, data));
  }

  // Premium system specific logging
  premiumCollectionStart(intervalKey) {
    this.info(`Premium collection started for: ${intervalKey}`);
  }

  premiumCollectionData(futureQuote, spotQuote, premiums) {
    this.info('Premium data collected', {
      future: futureQuote,
      spot: spotQuote,
      buyPremium: premiums.buy,
      sellPremium: premiums.sell
    });
  }

  premiumCollectionError(intervalKey, error) {
    this.error(`Premium collection failed for: ${intervalKey}`, error.message);
  }

  tokenUpdate(terminal, accountNumber, success) {
    if (success) {
      this.success(`Token updated for ${terminal} broker: ${accountNumber}`);
    } else {
      this.error(`Failed to update token for ${terminal} broker: ${accountNumber}`);
    }
  }

  companyNameResolution(server, companyName) {
    this.info(`Company name resolved: ${server} → ${companyName}`);
  }

  tableCreation(tableName, type) {
    this.success(`${type} table created/reused: ${tableName}`);
  }

  // WebSocket logging methods
  wsConnection(ip) {
    this.info('[WS] → new client', { ip });
  }

  wsMessage(action, payload) {
    this.debug('[WS] ← message', { action, payload });
  }

  wsInvalidMessage(raw) {
    this.warn('[WS] ← invalid JSON', { raw });
  }

  wsDisconnection(code) {
    this.info('[WS] ✖ disconnected', { code });
  }

  wsError(err) {
    this.error('[WS] ⚠ error', err.message || 'WebSocket error');
  }

  // Order execution specific logging
  orderExecution(message, data = null) {
    const timestamp = this.getTimestamp();
    let logEntry = `[${timestamp}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        logEntry += `\nData: ${JSON.stringify(data, null, 2)}`;
      } else {
        logEntry += `\nData: ${data}`;
      }
    }
    
    logEntry += '\n';

    try {
      // Write to order execution log file
      fs.appendFileSync(this.orderExecutionLogFile, logEntry);
      
      // Also write to main server log (for now since console.log is intercepted)
      console.log(`[ORDER] ${message}`, data || '');
    } catch (err) {
      console.error('Failed to write to order execution log:', err);
    }
  }

  orderSuccess(message, data = null) {
    this.orderExecution(`✅ ${message}`, data);
  }

  orderError(message, data = null) {
    this.orderExecution(`❌ ${message}`, data);
  }

  orderInfo(message, data = null) {
    this.orderExecution(`📊 ${message}`, data);
  }
}

module.exports = new Logger();