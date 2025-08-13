const { PendingOrder, AccountSet, Broker } = require('../models');
const tradingService = require('./tradingService');
const cachedQuoteService = require('./cachedQuoteService');

class PendingOrderMonitor {
  constructor() {
    this.isRunning = false;
    this.monitorInterval = null;
    this.checkInterval = 5000; // Check every 5 seconds
  }

  // Start monitoring pending orders
  start() {
    if (this.isRunning) {
      console.log('Pending order monitor is already running');
      return;
    }

    console.log('Starting pending order monitor...');
    this.isRunning = true;
    
    // Start monitoring loop
    this.monitorInterval = setInterval(async () => {
      await this.checkPendingOrders();
    }, this.checkInterval);

    console.log(`Pending order monitor started (checking every ${this.checkInterval}ms)`);
  }

  // Stop monitoring
  stop() {
    if (!this.isRunning) {
      console.log('Pending order monitor is not running');
      return;
    }

    console.log('Stopping pending order monitor...');
    this.isRunning = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    console.log('Pending order monitor stopped');
  }

  // Check all pending orders
  async checkPendingOrders() {
    try {
      const pendingOrders = await PendingOrder.findAll({
        where: { 
          status: 'Pending'
        },
        include: [
          {
            model: AccountSet,
            include: [{
              model: Broker,
              as: 'brokers'
            }]
          }
        ]
      });

      if (pendingOrders.length === 0) {
        return;
      }

      console.log(`Checking ${pendingOrders.length} pending orders...`);

      // Process each pending order
      for (const order of pendingOrders) {
        await this.processPendingOrder(order);
      }

    } catch (error) {
      console.error('Error checking pending orders:', error);
    }
  }

  // Process individual pending order
  async processPendingOrder(order) {
    try {
      // Check if order has expired
      const now = Date.now();
      const orderAge = now - new Date(order.createdAt).getTime();
      
      if (orderAge > order.maxAge) {
        console.log(`Order ${order.orderId} expired, cancelling...`);
        order.status = 'Expired';
        await order.save();
        return;
      }

      // Check if too many consecutive errors
      if (order.errorCount >= 10) {
        console.log(`Order ${order.orderId} has too many errors, cancelling...`);
        order.status = 'Error';
        await order.save();
        return;
      }

      // Get brokers
      const accountSet = order.AccountSet;
      if (!accountSet || !accountSet.brokers || accountSet.brokers.length < 2) {
        this.recordError(order, 'Account set or brokers not found');
        return;
      }

      const broker1 = accountSet.brokers.find(b => b.position === 1);
      const broker2 = accountSet.brokers.find(b => b.position === 2);

      if (!broker1 || !broker2) {
        this.recordError(order, 'Required broker positions not found');
        return;
      }

      // ✅ FIX: Use cached quotes instead of fresh API calls
      const quotes = await cachedQuoteService.getQuotes(
        broker1, order.broker1Symbol,
        broker2, order.broker2Symbol
      );

      if (!quotes || quotes.length !== 2) {
        this.recordError(order, 'Unable to get current quotes from cache or API');
        return;
      }

      const [futureQuote, spotQuote] = quotes;
      
      if (!futureQuote || !spotQuote || futureQuote.bid === 0 || spotQuote.bid === 0) {
        this.recordError(order, 'Invalid quote data received');
        return;
      }

      // Calculate current premium based on direction
      let currentPremium;
      if (order.direction === 'Buy') {
        currentPremium = (futureQuote.ask || 0) - (spotQuote.bid || 0);
      } else {
        currentPremium = (futureQuote.bid || 0) - (spotQuote.ask || 0);
      }

      // Update last checked and current premium
      order.lastChecked = new Date();
      order.currentPremium = currentPremium;
      order.errorCount = 0; // Reset error count on successful quote fetch
      await order.save();

      // Check if target premium is reached
      const targetReached = this.checkTargetReached(order, currentPremium);

      if (targetReached) {
        console.log(`Target premium reached for order ${order.orderId}! Executing trade...`);
        await this.executePendingOrder(order, currentPremium);
      }

    } catch (error) {
      console.error(`Error processing pending order ${order.orderId}:`, error);
      await this.recordError(order, error.message);
    }
  }

  // Check if target premium is reached
  checkTargetReached(order, currentPremium) {
    const target = parseFloat(order.targetPremium);
    const current = parseFloat(currentPremium);

    if (order.direction === 'Buy') {
      // For buy orders, execute when current premium is <= target (cheaper)
      return current <= target;
    } else {
      // For sell orders, execute when current premium is >= target (more expensive)
      return current >= target;
    }
  }

  // Execute pending order when target is reached
  async executePendingOrder(order, actualPremium) {
    try {
      // Execute trade at current premium
      const result = await tradingService.executeAtCurrentPremium({
        accountSetId: order.accountSetId,
        userId: order.userId,
        direction: order.direction,
        volume: parseFloat(order.volume),
        takeProfit: order.takeProfit ? parseFloat(order.takeProfit) : null,
        stopLoss: order.stopLoss ? parseFloat(order.stopLoss) : null,
        scalpingMode: order.scalpingMode,
        comment: `${order.comment} - Target Fill`
      });

      if (result.success) {
        // Mark order as filled
        order.status = 'Filled';
        order.filledTradeId = result.trade.tradeId;
        order.filledAt = new Date();
        order.filledPremium = actualPremium;
        await order.save();

        console.log(`✅ Pending order ${order.orderId} executed successfully!`);
        console.log(`Target: ${order.targetPremium}, Actual: ${actualPremium}`);
      } else {
        // Execution failed, record error but keep order active
        await this.recordError(order, `Execution failed: ${result.error}`);
        console.log(`❌ Failed to execute pending order ${order.orderId}: ${result.error}`);
      }

    } catch (error) {
      await this.recordError(order, `Execution error: ${error.message}`);
      console.error(`Error executing pending order ${order.orderId}:`, error);
    }
  }

  // Record error for an order
  async recordError(order, errorMessage) {
    try {
      order.errorCount = (order.errorCount || 0) + 1;
      order.lastError = errorMessage;
      order.lastChecked = new Date();
      await order.save();
    } catch (saveError) {
      console.error('Error saving order error:', saveError);
    }
  }

  // Get monitor status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval
    };
  }

  // Update check interval
  setCheckInterval(intervalMs) {
    this.checkInterval = intervalMs;
    
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

module.exports = new PendingOrderMonitor();