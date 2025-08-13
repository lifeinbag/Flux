// Migration to allow null broker fields for partial trades
const { sequelize } = require('../models');

async function allowNullBrokerFields() {
  try {
    console.log('Updating ActiveTrade table to allow null broker fields...');
    
    // Allow null for broker1 fields
    await sequelize.query(`
      ALTER TABLE active_trades 
      ALTER COLUMN "broker1Id" DROP NOT NULL,
      ALTER COLUMN "broker1Ticket" DROP NOT NULL,
      ALTER COLUMN "broker1Symbol" DROP NOT NULL,
      ALTER COLUMN "broker1Direction" DROP NOT NULL,
      ALTER COLUMN "broker1Volume" DROP NOT NULL;
    `);
    
    // Allow null for broker2 fields  
    await sequelize.query(`
      ALTER TABLE active_trades 
      ALTER COLUMN "broker2Id" DROP NOT NULL,
      ALTER COLUMN "broker2Ticket" DROP NOT NULL,
      ALTER COLUMN "broker2Symbol" DROP NOT NULL,
      ALTER COLUMN "broker2Direction" DROP NOT NULL,
      ALTER COLUMN "broker2Volume" DROP NOT NULL;
    `);
    
    console.log('✅ Successfully updated ActiveTrade table to allow null broker fields');
    
  } catch (error) {
    console.error('❌ Error updating ActiveTrade table:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  allowNullBrokerFields()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { allowNullBrokerFields };