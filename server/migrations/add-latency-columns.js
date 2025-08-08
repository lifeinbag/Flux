// Migration to add latency columns to account_sets table
const { sequelize } = require('../models');

async function addLatencyColumns() {
  try {
    console.log('Adding latency columns to account_sets table...');
    
    // Add the new columns
    await sequelize.query(`
      ALTER TABLE account_sets 
      ADD COLUMN IF NOT EXISTS "lastOrderBroker1Latency" INTEGER,
      ADD COLUMN IF NOT EXISTS "lastOrderBroker2Latency" INTEGER,
      ADD COLUMN IF NOT EXISTS "lastOrderTimestamp" TIMESTAMP WITH TIME ZONE;
    `);
    
    console.log('✅ Successfully added latency columns to account_sets table');
    
    // Add comments
    await sequelize.query(`
      COMMENT ON COLUMN account_sets."lastOrderBroker1Latency" IS 'Last order execution latency for broker 1 in milliseconds';
    `);
    
    await sequelize.query(`
      COMMENT ON COLUMN account_sets."lastOrderBroker2Latency" IS 'Last order execution latency for broker 2 in milliseconds';
    `);
    
    await sequelize.query(`
      COMMENT ON COLUMN account_sets."lastOrderTimestamp" IS 'Timestamp of last order execution';
    `);
    
    console.log('✅ Successfully added column comments');
    
  } catch (error) {
    console.error('❌ Error adding latency columns:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  addLatencyColumns()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addLatencyColumns };