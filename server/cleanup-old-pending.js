// Clean up old pending orders that should have been executed or expired
const { PendingOrder } = require('./models');
const { Op } = require('sequelize');

async function cleanupOldPendingOrders() {
  try {
    console.log('🧹 Starting cleanup of old pending orders...');
    
    // Get all pending orders older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const oldOrders = await PendingOrder.findAll({
      where: {
        status: 'Pending',
        createdAt: {
          [Op.lt]: oneDayAgo
        }
      }
    });
    
    console.log(`Found ${oldOrders.length} old pending orders to clean up`);
    
    let expiredCount = 0;
    let errorCount = 0;
    
    for (const order of oldOrders) {
      try {
        const ageHours = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
        
        if (ageHours > 24) {
          console.log(`📅 Expiring order ${order.orderId.slice(-8)} (${ageHours.toFixed(1)} hours old)`);
          order.status = 'Expired';
          await order.save();
          expiredCount++;
        } else if (order.errorCount > 10) {
          console.log(`❌ Marking error order ${order.orderId.slice(-8)} as failed`);
          order.status = 'Error';
          await order.save();
          errorCount++;
        }
      } catch (error) {
        console.error(`Failed to update order ${order.orderId}:`, error.message);
      }
    }
    
    console.log(`✅ Cleanup complete:`);
    console.log(`   - Expired: ${expiredCount} orders`);
    console.log(`   - Error: ${errorCount} orders`);
    console.log(`   - Total cleaned: ${expiredCount + errorCount} orders`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  } finally {
    process.exit(0);
  }
}

cleanupOldPendingOrders();