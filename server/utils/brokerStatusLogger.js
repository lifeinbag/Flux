// server/utils/brokerStatusLogger.js
const logger = require('./logger');

class BrokerStatusLogger {
  constructor() {
    this.brokerStatuses = new Map();
    this.displayInterval = null;
    this.statusUpdateInterval = 30000; // Update display every 30 seconds
    this.criticalErrors = [];
    this.maxCriticalErrors = 20; // Keep last 20 critical errors
  }

  start() {
    if (this.displayInterval) {
      return;
    }

    // Clear console and show initial table
    this.displayStatusTable();
    
    // Set up periodic display updates
    this.displayInterval = setInterval(() => {
      this.displayStatusTable();
    }, this.statusUpdateInterval);

    logger.info('🖥️ Broker Status Logger started - displaying every 30 seconds');
  }

  stop() {
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
      this.displayInterval = null;
    }
    logger.info('🖥️ Broker Status Logger stopped');
  }

  // Update broker status data
  updateBrokerStatus(accountSetName, brokerName, accountNumber, terminal, statusData) {
    const key = `${accountSetName}-${brokerName}-${accountNumber}`;
    
    const existing = this.brokerStatuses.get(key) || {};
    
    this.brokerStatuses.set(key, {
      accountSet: accountSetName,
      brokerName: brokerName,
      accountNumber: accountNumber,
      terminal: terminal,
      lastQuote: statusData.lastQuote || existing.lastQuote || 'Never',
      lastBalance: statusData.lastBalance || existing.lastBalance || 'Never',
      lastEquity: statusData.lastEquity || existing.lastEquity || 'Never',
      lastOrders: statusData.lastOrders || existing.lastOrders || 'Never',
      tokenStatus: statusData.tokenStatus || existing.tokenStatus || 'Unknown',
      lastError: statusData.lastError || existing.lastError || 'None',
      status: statusData.status || existing.status || '⚠️ Unknown',
      updatedAt: new Date().toLocaleTimeString()
    });
  }

  // Log critical errors for specific broker/account
  logCriticalError(accountSetName, brokerName, accountNumber, terminal, errorType, errorMessage) {
    const timestamp = new Date().toLocaleTimeString();
    const key = `${accountSetName}-${brokerName}-${accountNumber}`;
    
    // Add to critical errors list
    this.criticalErrors.unshift({
      timestamp,
      accountSet: accountSetName,
      brokerName,
      accountNumber,
      terminal,
      errorType,
      error: errorMessage
    });

    // Keep only last 20 errors
    if (this.criticalErrors.length > this.maxCriticalErrors) {
      this.criticalErrors = this.criticalErrors.slice(0, this.maxCriticalErrors);
    }

    // Update broker status with error
    this.updateBrokerStatus(accountSetName, brokerName, accountNumber, terminal, {
      status: `❌ ${errorType}`,
      lastError: `${errorType}: ${errorMessage}`,
      tokenStatus: errorType === 'Token' ? '❌ Failed' : undefined
    });

    // Force immediate display update for critical errors
    this.displayStatusTable();
  }

  // Log successful operations
  logSuccess(accountSetName, brokerName, accountNumber, terminal, operation, data = {}) {
    const timestamp = new Date().toLocaleTimeString();
    
    const statusUpdate = {
      status: '✅ Active',
      ...data
    };

    // Update specific operation timestamp
    switch (operation) {
      case 'quote':
        statusUpdate.lastQuote = timestamp;
        break;
      case 'balance':
        statusUpdate.lastBalance = timestamp;
        statusUpdate.lastEquity = timestamp;
        break;
      case 'orders':
        statusUpdate.lastOrders = timestamp;
        break;
      case 'token':
        statusUpdate.tokenStatus = '✅ Valid';
        break;
    }

    this.updateBrokerStatus(accountSetName, brokerName, accountNumber, terminal, statusUpdate);
  }

  // Display the main status table
  displayStatusTable() {
    console.clear();
    
    // Show header
    console.log('\n🌐 FLUX NETWORK - BROKER STATUS MONITOR');
    console.log('━'.repeat(160));
    console.log(`Last Updated: ${new Date().toLocaleString()}\n`);

    // Convert Map to array for display
    const statusArray = Array.from(this.brokerStatuses.values());
    
    if (statusArray.length === 0) {
      console.log('📊 No broker data available yet...\n');
    } else {
      // Use custom table formatting instead of console.table to prevent overlap
      this.displayCustomTable(statusArray);
    }

    // Show recent critical errors if any
    if (this.criticalErrors.length > 0) {
      console.log('\n🚨 RECENT CRITICAL ERRORS (Last 5):');
      console.log('━'.repeat(160));
      
      const recentErrors = this.criticalErrors.slice(0, 5);
      this.displayErrorsTable(recentErrors);
    }

    console.log('\n' + '━'.repeat(160));
    console.log('Press Ctrl+C to exit | Updates every 30 seconds\n');
  }

  // Custom table display to prevent text overlap
  displayCustomTable(statusArray) {
    // Define column widths
    const colWidths = {
      broker: 20,
      account: 12,
      terminal: 8,
      status: 12,
      token: 10,
      quote: 12,
      balance: 12,
      orders: 12,
      error: 30
    };

    // Helper function to truncate and pad text
    const formatCell = (text, width, align = 'left') => {
      if (!text) text = 'N/A';
      const str = String(text);
      const truncated = str.length > width - 1 ? str.substring(0, width - 4) + '...' : str;
      
      if (align === 'center') {
        return truncated.padStart((width + truncated.length) / 2).padEnd(width);
      }
      return align === 'right' ? truncated.padStart(width) : truncated.padEnd(width);
    };

    // Print header
    console.log(
      '│ ' + formatCell('brokerName', colWidths.broker) + 
      '│ ' + formatCell('accountNumber', colWidths.account) + 
      '│ ' + formatCell('terminal', colWidths.terminal) + 
      '│ ' + formatCell('lastQuote', colWidths.quote) + 
      '│ ' + formatCell('lastBalance', colWidths.balance) + 
      '│ ' + formatCell('lastOrders', colWidths.orders) + 
      '│ ' + formatCell('lastError', colWidths.error) + ' │'
    );

    console.log('├─' + '─'.repeat(colWidths.broker) + '┼─' + '─'.repeat(colWidths.account) + 
                '┼─' + '─'.repeat(colWidths.terminal) + '┼─' + '─'.repeat(colWidths.quote) + 
                '┼─' + '─'.repeat(colWidths.balance) + '┼─' + '─'.repeat(colWidths.orders) + 
                '┼─' + '─'.repeat(colWidths.error) + '─┤');

    // Print each row
    statusArray.forEach(status => {
      console.log(
        '│ ' + formatCell(status.brokerName, colWidths.broker) + 
        '│ ' + formatCell(status.accountNumber, colWidths.account) + 
        '│ ' + formatCell(status.terminal, colWidths.terminal) + 
        '│ ' + formatCell(status.lastQuote, colWidths.quote) + 
        '│ ' + formatCell(status.lastBalance, colWidths.balance) + 
        '│ ' + formatCell(status.lastOrders, colWidths.orders) + 
        '│ ' + formatCell(status.lastError, colWidths.error) + ' │'
      );
    });

    console.log('└─' + '─'.repeat(colWidths.broker) + '┴─' + '─'.repeat(colWidths.account) + 
                '┴─' + '─'.repeat(colWidths.terminal) + '┴─' + '─'.repeat(colWidths.quote) + 
                '┴─' + '─'.repeat(colWidths.balance) + '┴─' + '─'.repeat(colWidths.orders) + 
                '┴─' + '─'.repeat(colWidths.error) + '─┘');
  }

  // Custom errors table display
  displayErrorsTable(errors) {
    // Define column widths for errors table
    const colWidths = {
      time: 10,
      broker: 18,
      account: 12,
      terminal: 8,
      errorType: 12,
      error: 45
    };

    // Helper function to truncate and pad text
    const formatCell = (text, width, align = 'left') => {
      if (!text) text = 'N/A';
      const str = String(text);
      const truncated = str.length > width - 1 ? str.substring(0, width - 4) + '...' : str;
      
      if (align === 'center') {
        return truncated.padStart((width + truncated.length) / 2).padEnd(width);
      }
      return align === 'right' ? truncated.padStart(width) : truncated.padEnd(width);
    };

    // Print header
    console.log(
      '│ ' + formatCell('Time', colWidths.time) + 
      '│ ' + formatCell('Broker', colWidths.broker) + 
      '│ ' + formatCell('Account', colWidths.account) + 
      '│ ' + formatCell('Terminal', colWidths.terminal) + 
      '│ ' + formatCell('Error Type', colWidths.errorType) + 
      '│ ' + formatCell('Error Message', colWidths.error) + ' │'
    );

    console.log('├─' + '─'.repeat(colWidths.time) + '┼─' + '─'.repeat(colWidths.broker) + 
                '┼─' + '─'.repeat(colWidths.account) + '┼─' + '─'.repeat(colWidths.terminal) + 
                '┼─' + '─'.repeat(colWidths.errorType) + '┼─' + '─'.repeat(colWidths.error) + '─┤');

    // Print each error row
    errors.forEach(error => {
      console.log(
        '│ ' + formatCell(error.timestamp, colWidths.time) + 
        '│ ' + formatCell(error.brokerName, colWidths.broker) + 
        '│ ' + formatCell(error.accountNumber, colWidths.account) + 
        '│ ' + formatCell(error.terminal, colWidths.terminal) + 
        '│ ' + formatCell(error.errorType, colWidths.errorType) + 
        '│ ' + formatCell(error.error, colWidths.error) + ' │'
      );
    });

    console.log('└─' + '─'.repeat(colWidths.time) + '┴─' + '─'.repeat(colWidths.broker) + 
                '┴─' + '─'.repeat(colWidths.account) + '┴─' + '─'.repeat(colWidths.terminal) + 
                '┴─' + '─'.repeat(colWidths.errorType) + '┴─' + '─'.repeat(colWidths.error) + '─┘');
  }

  // Get status summary for API endpoints
  getStatusSummary() {
    const statusArray = Array.from(this.brokerStatuses.values());
    
    const summary = {
      totalBrokers: statusArray.length,
      activeBrokers: statusArray.filter(s => s.status.includes('✅')).length,
      errorBrokers: statusArray.filter(s => s.status.includes('❌')).length,
      warningBrokers: statusArray.filter(s => s.status.includes('⚠️')).length,
      recentErrors: this.criticalErrors.slice(0, 10),
      brokerStatuses: statusArray
    };

    return summary;
  }

  // Clear all stored data
  clearAll() {
    this.brokerStatuses.clear();
    this.criticalErrors = [];
    logger.info('🧹 Broker status data cleared');
  }
}

// Export singleton instance
module.exports = new BrokerStatusLogger();