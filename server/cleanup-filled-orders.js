// Remove all executed (Filled) pending orders from database
const { PendingOrder } = require('./models');

async function cleanupFilledOrders() {
  try {
    console.log('🧹 Removing executed (Filled) pending orders from database...\n');
    
    // Find all filled orders
    const filledOrders = await PendingOrder.findAll({
      where: { status: 'Filled' }
    });
    
    console.log(`Found ${filledOrders.length} filled orders to remove:`);
    
    for (const order of filledOrders) {
      console.log(`🗑️ Removing order ${order.orderId.slice(-8)} (Target: ${order.targetPremium})`);
      await order.destroy();
    }
    
    console.log(`\n✅ Removed ${filledOrders.length} filled orders from database`);
    
    // Show remaining pending orders
    const remainingOrders = await PendingOrder.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`\n📋 Remaining orders in database: ${remainingOrders.length}`);
    remainingOrders.forEach(order => {
      console.log(`  - ${order.orderId.slice(-8)}: ${order.status} (Target: ${order.targetPremium})`);
    });
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  } finally {
    process.exit(0);
  }
}

cleanupFilledOrders();