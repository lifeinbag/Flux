// Clean up orders with errors and show current status
const { PendingOrder } = require('./models');

async function cleanupErrorOrders() {
  try {
    console.log('🔍 Checking pending orders with errors...\n');
    
    // Get all orders
    const allOrders = await PendingOrder.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`Found ${allOrders.length} total orders in database:`);
    
    let errorCount = 0;
    let cleanupCount = 0;
    
    for (const order of allOrders) {
      const ageHours = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
      
      console.log(`📋 Order ${order.orderId.slice(-8)}:`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Target: ${order.targetPremium}`);
      console.log(`   Error Count: ${order.errorCount || 0}`);
      console.log(`   Age: ${ageHours.toFixed(1)} hours`);
      
      // Clean up orders with high error count or very old cancelled orders
      if (order.errorCount > 5 || (order.status === 'Cancelled' && ageHours > 24)) {
        console.log(`🗑️ Removing error/old order...`);
        await order.destroy();
        cleanupCount++;
      }
      
      if (order.errorCount > 0) {
        errorCount++;
      }
      
      console.log('');
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total orders checked: ${allOrders.length}`);
    console.log(`   Orders with errors: ${errorCount}`);
    console.log(`   Orders cleaned up: ${cleanupCount}`);
    
    // Show final status
    const remainingOrders = await PendingOrder.findAll();
    console.log(`   Orders remaining: ${remainingOrders.length}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    process.exit(0);
  }
}

cleanupErrorOrders();