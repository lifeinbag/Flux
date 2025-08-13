// Fix existing issues in the database
const { ActiveTrade, PendingOrder } = require('./models');

async function fixExistingIssues() {
  console.log('🔧 Fixing existing database issues...\n');
  
  try {
    // 1. Fix partial trade statuses
    console.log('1. 🔄 Fixing partial trade statuses...');
    const partialTrades = await ActiveTrade.findAll({
      where: { status: 'Partial' }
    });
    
    if (partialTrades.length > 0) {
      console.log(`Found ${partialTrades.length} trades with incorrect 'Partial' status`);
      for (const trade of partialTrades) {
        trade.status = 'PartiallyFilled';
        await trade.save();
        console.log(`✅ Fixed status for trade ${trade.tradeId.slice(-8)}`);
      }
    } else {
      console.log('✅ No partial trades to fix');
    }
    
    // 2. Check for trades that should be closed
    console.log('\n2. 🔍 Checking for trades that should be in closed status...');
    const activeTrades = await ActiveTrade.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`Found ${activeTrades.length} active trades:`);
    activeTrades.forEach(trade => {
      const ageHours = (Date.now() - new Date(trade.createdAt).getTime()) / (1000 * 60 * 60);
      console.log(`- Trade ${trade.tradeId.slice(-8)}: Status=${trade.status}, Age=${ageHours.toFixed(1)}h, B1=${trade.broker1Ticket}, B2=${trade.broker2Ticket}`);
    });
    
    // 3. Check pending order statuses
    console.log('\n3. 📋 Checking pending order statuses...');
    const allPendingOrders = await PendingOrder.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    console.log('Recent pending orders:');
    allPendingOrders.forEach(order => {
      const ageHours = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
      console.log(`- Order ${order.orderId.slice(-8)}: Status=${order.status}, Age=${ageHours.toFixed(1)}h, Target=${order.targetPremium}`);
    });
    
    console.log('\n✅ Database check completed!');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    process.exit(0);
  }
}

fixExistingIssues();