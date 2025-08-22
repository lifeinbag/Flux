// server/utils/simpleStatusLogger.js
class SimpleStatusLogger {
  constructor() {
    this.brokerData = new Map();
    this.lastDisplay = 0;
    this.displayInterval = 10000; // Show every 10 seconds
    this.intervalId = null;
  }

  updateBrokerStatus(brokerName, accountNumber, terminal, operation, status, error = null) {
    const key = `${brokerName}-${accountNumber}`;
    const now = new Date().toLocaleTimeString();
    
    const existing = this.brokerData.get(key) || {
      brokerName,
      accountNumber,
      terminal,
      lastQuote: 'Never',
      lastBalance: 'Never',
      lastOrders: 'Never',
      lastError: 'None'
    };

    // Update specific operation
    if (operation === 'quote') existing.lastQuote = status === 'success' ? now : 'Failed';
    if (operation === 'balance') existing.lastBalance = status === 'success' ? now : 'Failed';
    if (operation === 'orders') existing.lastOrders = status === 'success' ? now : 'Failed';
    if (error) existing.lastError = error.substring(0, 50);

    this.brokerData.set(key, existing);
    this.maybeShowTable();
  }

  maybeShowTable() {
    const now = Date.now();
    if (now - this.lastDisplay > this.displayInterval) {
      this.showTable();
      this.lastDisplay = now;
    }
  }

  showTable() {
    console.clear();
    console.log('\n🌐 FLUX NETWORK - BROKER STATUS');
    console.log('━'.repeat(80));
    
    const data = Array.from(this.brokerData.values());
    if (data.length > 0) {
      console.table(data);
    } else {
      console.log('No broker data available yet...');
    }
    
    console.log('━'.repeat(80));
    console.log(`Last Updated: ${new Date().toLocaleString()}\n`);
  }

  start() {
    if (this.intervalId) return;
    
    // Add some sample data if no data exists
    if (this.brokerData.size === 0) {
      this.brokerData.set('sample', {
        brokerName: 'Waiting for broker activity...',
        accountNumber: 'N/A',
        terminal: 'N/A',
        lastQuote: 'N/A',
        lastBalance: 'N/A', 
        lastOrders: 'N/A',
        lastError: 'None'
      });
    }
    
    // Show table immediately
    this.showTable();
    
    // Set up regular updates
    this.intervalId = setInterval(() => {
      this.showTable();
    }, this.displayInterval);
    
    console.log('📊 Simple Status Logger started - updating every 10 seconds');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

module.exports = new SimpleStatusLogger();