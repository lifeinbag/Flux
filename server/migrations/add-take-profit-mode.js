// Migration to add takeProfitMode columns to trading tables
const { sequelize } = require('../models');

async function addTakeProfitModeColumns() {
  try {
    console.log('Adding takeProfitMode columns to trading tables...');
    
    // Create ENUM type first if it doesn't exist
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE take_profit_mode_enum AS ENUM ('None', 'Premium', 'Amount');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    // Add takeProfitMode column to active_trades table
    await sequelize.query(`
      ALTER TABLE active_trades 
      ADD COLUMN IF NOT EXISTS "takeProfitMode" take_profit_mode_enum DEFAULT 'None' NOT NULL;
    `);
    
    // Add takeProfitMode column to closed_trades table
    await sequelize.query(`
      ALTER TABLE closed_trades 
      ADD COLUMN IF NOT EXISTS "takeProfitMode" take_profit_mode_enum DEFAULT 'None' NOT NULL;
    `);
    
    // Add takeProfitMode column to pending_orders table
    await sequelize.query(`
      ALTER TABLE pending_orders 
      ADD COLUMN IF NOT EXISTS "takeProfitMode" take_profit_mode_enum DEFAULT 'None' NOT NULL;
    `);
    
    console.log('✅ Successfully added takeProfitMode columns to all trading tables');
    
    // Add comments
    await sequelize.query(`
      COMMENT ON COLUMN active_trades."takeProfitMode" IS 'Take profit mode: None, Premium (deficit premium target), or Amount (dollar amount target)';
    `);
    
    await sequelize.query(`
      COMMENT ON COLUMN closed_trades."takeProfitMode" IS 'Take profit mode: None, Premium (deficit premium target), or Amount (dollar amount target)';
    `);
    
    await sequelize.query(`
      COMMENT ON COLUMN pending_orders."takeProfitMode" IS 'Take profit mode: None, Premium (deficit premium target), or Amount (dollar amount target)';
    `);
    
    console.log('✅ Successfully added column comments');
    
  } catch (error) {
    console.error('❌ Error adding takeProfitMode columns:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  addTakeProfitModeColumns()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addTakeProfitModeColumns };