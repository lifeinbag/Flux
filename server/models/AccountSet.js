// server/models/AccountSet.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Define the AccountSet model
const AccountSet = sequelize.define('AccountSet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  _id: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.id;
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'New Set',
  },
  futureSymbol: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  spotSymbol: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  symbolsLocked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  companyMappings: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Stores broker terminal to company name mappings'
  },
  premiumTableName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Reference to the premium table name for this symbol pair + company combination'
  },
  lastOrderBroker1Latency: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Last order execution latency for broker 1 in milliseconds'
  },
  lastOrderBroker2Latency: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Last order execution latency for broker 2 in milliseconds'
  },
  lastOrderTimestamp: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp of last order execution'
  },
}, {
  tableName: 'account_sets',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

// Define the Broker model
const Broker = sequelize.define('Broker', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  _id: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.id;
    }
  },
  accountSetId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'account_sets',
      key: 'id',
    },
  },
  brokerName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'User-defined broker name for table organization'
  },
  terminal: {
    type: DataTypes.ENUM('MT4', 'MT5'),
    allowNull: false,
  },
  accountNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  server: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Trading session token from broker connection'
  },
  tokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Token expiration timestamp'
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Company name extracted from broker API for data mapping'
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Order position of broker within an account set (1 for first, 2 for second)'
  },
  externalApiId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'External API ID for fetching open orders from MT4/MT5 services'
  }
}, {
  tableName: 'brokers',
  timestamps: true,
  hooks: {
    afterSave: (broker) => {
      if (broker.changed('token') && broker.token) {
        const { TokenManager } = require('../token-manager');
        const TOKEN_TTL_MS = 22 * 60 * 60 * 1000;
        const key = TokenManager._generateKey(
          broker.terminal === 'MT5',
          broker.server,
          broker.accountNumber,
          broker.id,
          broker.position
        );
        TokenManager.cache.set(key, {
          token: broker.token,
          lastFetch: new Date(broker.tokenExpiresAt) - TOKEN_TTL_MS,
          hostPort: null // Will be refetched if needed
        });
      }
    }
  }
});

// Note: associations between AccountSet and Broker are defined in server/models/index.js

module.exports = { AccountSet, Broker };