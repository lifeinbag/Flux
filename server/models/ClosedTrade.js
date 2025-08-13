const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClosedTrade = sequelize.define('ClosedTrade', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Trade identification (from ActiveTrade)
  tradeId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Original trade ID from active trades'
  },
  
  // Account set reference
  accountSetId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'account_sets',
      key: 'id'
    }
  },
  
  // User reference
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  
  // Broker 1 (Future) trade details
  broker1Id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  broker1Ticket: {
    type: DataTypes.STRING,
    allowNull: false
  },
  broker1Symbol: {
    type: DataTypes.STRING,
    allowNull: false
  },
  broker1Direction: {
    type: DataTypes.ENUM('Buy', 'Sell'),
    allowNull: false
  },
  broker1Volume: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  broker1OpenPrice: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true
  },
  broker1ClosePrice: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true
  },
  broker1OpenTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  broker1CloseTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  broker1Profit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  
  // Broker 2 (Spot) trade details
  broker2Id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  broker2Ticket: {
    type: DataTypes.STRING,
    allowNull: false
  },
  broker2Symbol: {
    type: DataTypes.STRING,
    allowNull: false
  },
  broker2Direction: {
    type: DataTypes.ENUM('Buy', 'Sell'),
    allowNull: false
  },
  broker2Volume: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  broker2OpenPrice: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true
  },
  broker2ClosePrice: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true
  },
  broker2OpenTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  broker2CloseTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  broker2Profit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  
  // Trade performance metrics
  executionPremium: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: false,
    comment: 'Premium at which trade was executed'
  },
  closePremium: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: false,
    comment: 'Premium at which trade was closed'
  },
  totalProfit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Combined profit from both brokers'
  },
  
  // Trade parameters that were set
  takeProfit: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true
  },
  takeProfitMode: {
    type: DataTypes.ENUM('None', 'Premium', 'Amount'),
    defaultValue: 'None',
    allowNull: false,
    comment: 'Take profit mode: None, Premium (deficit premium target), or Amount (dollar amount target)'
  },
  stopLoss: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true
  },
  
  // Close reason
  closeReason: {
    type: DataTypes.ENUM('Manual', 'TakeProfit', 'StopLoss', 'Error', 'Expired'),
    allowNull: false,
    defaultValue: 'Manual'
  },
  
  // Duration metrics
  tradeDurationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Trade duration in minutes'
  },
  
  // Execution metrics
  broker1Latency: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Order execution latency for broker 1 in ms'
  },
  broker2Latency: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Order execution latency for broker 2 in ms'
  },
  
  // Comments and notes
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Scalping mode indicator
  scalpingMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
  
}, {
  tableName: 'closed_trades',
  timestamps: true,
  indexes: [
    {
      fields: ['accountSetId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['tradeId']
    },
    {
      fields: ['broker1Ticket']
    },
    {
      fields: ['broker2Ticket']
    },
    {
      fields: ['closeReason']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = ClosedTrade;