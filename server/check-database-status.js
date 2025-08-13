// Check actual database status
const { ActiveTrade, PendingOrder, sequelize } = require('./models');

async function checkDatabaseStatus() {
  console.log('🔍 Checking actual database status...\n');
  
  try {
    // 1. Check active trades with status breakdown
    console.log('1. 📊 Active Trades Status Breakdown:');
    const statusCounts = await ActiveTrade.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('status')), 'count']
      ],
      group: ['status'],
      raw: true
    });
    
    statusCounts.forEach(row => {
      console.log(`   ${row.status}: ${row.count} trades`);
    });
    
    // 2. Check recent active trades details
    console.log('\n2. 🔍 Recent Active Trades Details:');
    const recentTrades = await ActiveTrade.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    recentTrades.forEach((trade, index) => {
      const ageMinutes = (Date.now() - new Date(trade.createdAt).getTime()) / (1000 * 60);
      const isPartial = !trade.broker1Ticket || !trade.broker2Ticket;
      console.log(`${index + 1}. Trade ${trade.tradeId.slice(-8)}:`);
      console.log(`   Status: ${trade.status}`);
      console.log(`   Age: ${ageMinutes.toFixed(1)} minutes`);
      console.log(`   Broker1 Ticket: ${trade.broker1Ticket || 'NULL'}`);
      console.log(`   Broker2 Ticket: ${trade.broker2Ticket || 'NULL'}`);
      console.log(`   Is Partial: ${isPartial ? 'YES' : 'NO'}`);
      console.log(`   Comment: ${trade.comment || 'None'}`);
      console.log('');
    });
    
    // 3. Check pending orders status
    console.log('3. 📋 Pending Orders Status Breakdown:');
    const pendingStatusCounts = await PendingOrder.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('status')), 'count']
      ],
      group: ['status'],
      raw: true
    });
    
    pendingStatusCounts.forEach(row => {
      console.log(`   ${row.status}: ${row.count} orders`);
    });
    
    console.log('\n✅ Database status check completed!');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    process.exit(0);
  }
}

checkDatabaseStatus();