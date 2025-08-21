// server/utils/logger.js
const winston = require('winston');
const fs = require('fs');
const path = require('path');

const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

const logger = winston.createLogger({
  level,
  transports: [
    // still log to console
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    // also append everything ≥ debug to server.log:
    new winston.transports.File({
      filename: 'logs/server.log',
      level: 'debug',
      format: winston.format.json()
    })
  ]
});

class Logger {
  constructor() {
    this.winston = logger;
    this.logFile = path.join(__dirname, '..', 'premium_system.log');
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.ensureLogFile();
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
}

module.exports = new Logger();