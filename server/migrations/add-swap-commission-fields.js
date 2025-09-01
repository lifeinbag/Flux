'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add swap and commission fields to closed_trades table
    await queryInterface.addColumn('closed_trades', 'broker1Swap', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Swap charges for broker1 position'
    });
    
    await queryInterface.addColumn('closed_trades', 'broker2Swap', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Swap charges for broker2 position'
    });
    
    await queryInterface.addColumn('closed_trades', 'broker1Commission', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Commission charges for broker1 position'
    });
    
    await queryInterface.addColumn('closed_trades', 'broker2Commission', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Commission charges for broker2 position'
    });
    
    await queryInterface.addColumn('closed_trades', 'totalSwap', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Combined swap charges from both brokers'
    });
    
    await queryInterface.addColumn('closed_trades', 'totalCommission', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Combined commission charges from both brokers'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove swap and commission fields from closed_trades table
    await queryInterface.removeColumn('closed_trades', 'broker1Swap');
    await queryInterface.removeColumn('closed_trades', 'broker2Swap');
    await queryInterface.removeColumn('closed_trades', 'broker1Commission');
    await queryInterface.removeColumn('closed_trades', 'broker2Commission');
    await queryInterface.removeColumn('closed_trades', 'totalSwap');
    await queryInterface.removeColumn('closed_trades', 'totalCommission');
  }
};