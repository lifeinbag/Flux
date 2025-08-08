// server/models/index.js
const sequelize = require('../config/database');
const User = require('./User');
const { AccountSet, Broker } = require('./AccountSet');
const Otp = require('./Otp');
const ActiveTrade = require('./ActiveTrade');
const ClosedTrade = require('./ClosedTrade');
const PendingOrder = require('./PendingOrder');

// Define associations between models

// User <-> AccountSet associations
User.hasMany(AccountSet, { as: 'accountSets', foreignKey: 'userId', onDelete: 'CASCADE' });
AccountSet.belongsTo(User, { foreignKey: 'userId' });

// AccountSet <-> Broker associations
AccountSet.hasMany(Broker, { as: 'brokers', foreignKey: 'accountSetId', onDelete: 'CASCADE' });
Broker.belongsTo(AccountSet, { foreignKey: 'accountSetId' });

// User self-referential associations for sponsor/referrals
User.belongsTo(User, { as: 'sponsor', foreignKey: 'sponsorId' });
User.hasMany(User, { as: 'referrals', foreignKey: 'sponsorId' });

// Trading associations
// User <-> ActiveTrade associations
User.hasMany(ActiveTrade, { as: 'activeTrades', foreignKey: 'userId', onDelete: 'CASCADE' });
ActiveTrade.belongsTo(User, { foreignKey: 'userId' });

// User <-> ClosedTrade associations  
User.hasMany(ClosedTrade, { as: 'closedTrades', foreignKey: 'userId', onDelete: 'CASCADE' });
ClosedTrade.belongsTo(User, { foreignKey: 'userId' });

// User <-> PendingOrder associations
User.hasMany(PendingOrder, { as: 'pendingOrders', foreignKey: 'userId', onDelete: 'CASCADE' });
PendingOrder.belongsTo(User, { foreignKey: 'userId' });

// AccountSet <-> Trading associations
AccountSet.hasMany(ActiveTrade, { as: 'activeTrades', foreignKey: 'accountSetId', onDelete: 'CASCADE' });
ActiveTrade.belongsTo(AccountSet, { foreignKey: 'accountSetId' });

AccountSet.hasMany(ClosedTrade, { as: 'closedTrades', foreignKey: 'accountSetId', onDelete: 'CASCADE' });
ClosedTrade.belongsTo(AccountSet, { foreignKey: 'accountSetId' });

AccountSet.hasMany(PendingOrder, { as: 'pendingOrders', foreignKey: 'accountSetId', onDelete: 'CASCADE' });
PendingOrder.belongsTo(AccountSet, { foreignKey: 'accountSetId' });

// Broker <-> Trading associations
Broker.hasMany(ActiveTrade, { as: 'activeTradesBroker1', foreignKey: 'broker1Id' });
Broker.hasMany(ActiveTrade, { as: 'activeTradesBroker2', foreignKey: 'broker2Id' });
ActiveTrade.belongsTo(Broker, { as: 'broker1', foreignKey: 'broker1Id' });
ActiveTrade.belongsTo(Broker, { as: 'broker2', foreignKey: 'broker2Id' });

Broker.hasMany(PendingOrder, { as: 'pendingOrdersBroker1', foreignKey: 'broker1Id' });
Broker.hasMany(PendingOrder, { as: 'pendingOrdersBroker2', foreignKey: 'broker2Id' });
PendingOrder.belongsTo(Broker, { as: 'broker1', foreignKey: 'broker1Id' });
PendingOrder.belongsTo(Broker, { as: 'broker2', foreignKey: 'broker2Id' });

// Sync database (create tables)
const syncDatabase = async () => {
  try {
    // First, sync without altering to avoid enum issues
    await sequelize.sync({ force: false });
    console.log('PostgreSQL database synced successfully');
  } catch (error) {
    console.error('Error syncing database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  User,
  AccountSet,
  Broker,
  Otp,
  ActiveTrade,
  ClosedTrade,
  PendingOrder,
  syncDatabase,
};