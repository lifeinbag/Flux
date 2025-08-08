const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ActiveTrade = sequelize.define('ActiveTrade', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Trade identification
  tradeId: {
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
  
  // Broker 1 (Future) trade details
  broker1Id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'brokers',
      key: 'id'
    }
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
  broker1OpenTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  
  // Broker 2 (Spot) trade details
  broker2Id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'brokers',
      key: 'id'
    }
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
  broker2OpenTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  
  // Trade parameters
  executionPremium: {
    type: DataTypes.DECIMAL(10, 5),
    allowNull: false,
    comment: 'Premium at which trade was executed'
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
  
  // Trade status and tracking
  status: {
    type: DataTypes.ENUM('Active', 'PartiallyFilled', 'Closed', 'Error'),
    defaultValue: 'Active',
    allowNull: false
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
  tableName: 'active_trades',
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
      fields: ['status']
    }
  ]
});

module.exports = ActiveTrade;