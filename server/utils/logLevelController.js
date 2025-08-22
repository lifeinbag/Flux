// server/utils/logLevelController.js
const brokerStatusLogger = require('./brokerStatusLogger');

class LogLevelController {
  constructor() {
    this.verboseLogging = false;
    this.statusDisplayEnabled = true;
    this.originalConsoleLog = console.log;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;
    this.suppressedMessages = [];
    this.maxSuppressedMessages = 100;
  }

  // Patterns of logs to suppress when verbose logging is disabled
  getVerbosePatterns() {
    return [
      /🔄.*fetching/i,
      /📊.*premium.*recorded/i,
      /💾.*using.*cached/i,
      /🌐.*fetching.*fresh/i,
      /✅.*token.*updated/i,
      /📈.*quote.*received/i,
      /🎯.*using.*cached.*symbols/i,
      /⚡.*websocket.*message/i,
      /🚀.*api.*request/i,
      /💹.*balance.*fetch/i,
      /📋.*position.*update/i,
      /⏰.*interval.*update/i,
      /🔄.*refreshing.*cache/i,
      /🎪.*premium.*collection/i
    ];
  }

  // Check if a message should be suppressed
  shouldSuppressMessage(message) {
    if (this.verboseLogging) {
      return false;
    }

    const messageStr = typeof message === 'string' ? message : String(message);
    return this.getVerbosePatterns().some(pattern => pattern.test(messageStr));
  }

  // Store suppressed message for later review
  storeSuppressedMessage(level, message, ...args) {
    this.suppressedMessages.unshift({
      timestamp: new Date().toISOString(),
      level,
      message,
      args: args.length > 0 ? args : undefined
    });

    // Keep only last N messages
    if (this.suppressedMessages.length > this.maxSuppressedMessages) {
      this.suppressedMessages = this.suppressedMessages.slice(0, this.maxSuppressedMessages);
    }
  }

  // Override console methods to filter verbose logs
  setupLogFiltering() {
    // Override console.log
    console.log = (...args) => {
      const message = args[0];
      if (this.shouldSuppressMessage(message)) {
        this.storeSuppressedMessage('LOG', message, ...args.slice(1));
        return;
      }
      this.originalConsoleLog.apply(console, args);
    };

    // Override console.warn
    console.warn = (...args) => {
      const message = args[0];
      if (this.shouldSuppressMessage(message)) {
        this.storeSuppressedMessage('WARN', message, ...args.slice(1));
        return;
      }
      this.originalConsoleWarn.apply(console, args);
    };

    // Keep console.error as is (always show errors)
    console.error = this.originalConsoleError;
  }

  // Restore original console methods
  restoreLogging() {
    console.log = this.originalConsoleLog;
    console.warn = this.originalConsoleWarn;
    console.error = this.originalConsoleError;
  }

  // Enable verbose logging (show all messages)
  enableVerboseLogging() {
    this.verboseLogging = true;
    console.log('🔊 Verbose logging enabled - showing all messages');
  }

  // Disable verbose logging (filter out noise)
  disableVerboseLogging() {
    this.verboseLogging = false;
    console.log('🔇 Verbose logging disabled - filtering noise');
  }

  // Toggle verbose logging
  toggleVerboseLogging() {
    if (this.verboseLogging) {
      this.disableVerboseLogging();
    } else {
      this.enableVerboseLogging();
    }
    return this.verboseLogging;
  }

  // Enable status display
  enableStatusDisplay() {
    this.statusDisplayEnabled = true;
    brokerStatusLogger.start();
    console.log('📊 Status display enabled');
  }

  // Disable status display
  disableStatusDisplay() {
    this.statusDisplayEnabled = false;
    brokerStatusLogger.stop();
    console.log('📊 Status display disabled');
  }

  // Toggle status display
  toggleStatusDisplay() {
    if (this.statusDisplayEnabled) {
      this.disableStatusDisplay();
    } else {
      this.enableStatusDisplay();
    }
    return this.statusDisplayEnabled;
  }

  // Get current settings
  getSettings() {
    return {
      verboseLogging: this.verboseLogging,
      statusDisplayEnabled: this.statusDisplayEnabled,
      suppressedMessagesCount: this.suppressedMessages.length
    };
  }

  // Get recent suppressed messages
  getSuppressedMessages(limit = 20) {
    return this.suppressedMessages.slice(0, limit);
  }

  // Clear suppressed messages
  clearSuppressedMessages() {
    this.suppressedMessages = [];
    console.log('🧹 Suppressed messages cleared');
  }

  // Set up clean console environment
  setupCleanEnvironment() {
    this.setupLogFiltering();
    this.disableVerboseLogging();
    this.enableStatusDisplay();
    
    console.log('\n🚀 FLUX NETWORK - CLEAN LOGGING ENVIRONMENT ACTIVATED');
    console.log('━'.repeat(80));
    console.log('📊 Status display: ENABLED (organized broker status)');
    console.log('🔇 Verbose logging: DISABLED (filtered noise)');
    console.log('❌ Error logging: ALWAYS ENABLED');
    console.log('━'.repeat(80));
    console.log('💡 Use logController.toggleVerboseLogging() to see all logs');
    console.log('💡 Use logController.getSuppressedMessages() to see filtered logs\n');
  }

  // Quick start method
  start() {
    this.setupCleanEnvironment();
  }

  // Clean shutdown
  stop() {
    this.restoreLogging();
    this.disableStatusDisplay();
    console.log('🛑 Log level controller stopped - logging restored to default');
  }
}

// Export singleton instance
module.exports = new LogLevelController();