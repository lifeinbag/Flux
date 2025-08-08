const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PendingOrder = sequelize.define('PendingOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Order identification
  orderId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    unique: true,
    allowNull: false
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
  
  // Broker references
  broker1Id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'brokers',
      key: 'id'
    }
  },
  broker2Id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'brokers',
      key: 'id'
    }
  },
  
  // Symbol configuration
  broker1Symbol: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Future symbol for broker 1'
  },
  broker2Symbol: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Spot symbol for broker 2'
  },
  
  // Trade parameters
  direction: {
    type: DataTypes.ENUM('Buy', 'Sell'),
    allowNull: false,
    comment: 'Trade direction (broker 2 will be reverse)'
  },
  volume: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Trade volume/lot size'
  },
  targetPremium: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: false,
    comment: 'Target premium to execute at'
  },
  takeProfit: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true,
    comment: 'Take profit level'
  },
  stopLoss: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true,
    comment: 'Stop loss level'
  },
  
  // Order status
  status: {
    type: DataTypes.ENUM('Pending', 'Filled', 'Cancelled', 'Expired', 'Error'),
    defaultValue: 'Pending',
    allowNull: false
  },
  
  // Monitoring settings
  checkInterval: {
    type: DataTypes.INTEGER,
    defaultValue: 5000,
    comment: 'How often to check premium in milliseconds'
  },
  maxAge: {
    type: DataTypes.INTEGER,
    defaultValue: 3600000,
    comment: 'Max age before expiring in milliseconds (default: 1 hour)'
  },
  
  // Execution tracking
  lastChecked: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time premium was checked'
  },
  currentPremium: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true,
    comment: 'Last observed premium value'
  },
  
  // Filled order details (when executed)
  filledTradeId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Trade ID when order gets filled'
  },
  filledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the order was filled'
  },
  filledPremium: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: true,
    comment: 'Actual premium when filled'
  },
  
  // Error tracking
  errorCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of consecutive errors'
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Last error message'
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
  tableName: 'pending_orders',
  timestamps: true,
  indexes: [
    {
      fields: ['accountSetId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['orderId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['targetPremium']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['lastChecked']
    }
  ]
});

module.exports = PendingOrder;