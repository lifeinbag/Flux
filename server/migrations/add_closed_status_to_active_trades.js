const { QueryInterface, DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'Closed' to the enum
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_active_trades_status" ADD VALUE 'Closed';`
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Note: PostgreSQL doesn't support removing enum values directly
    // This would require recreating the enum and updating all references
    console.log('Warning: Cannot remove enum value in PostgreSQL. Manual intervention required.');
  }
};