// server/config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'flux_network',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || '1234',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,

    // Bigger pool to prevent ConnectionAcquireTimeoutError
    pool: {
      max: 20,        // was 5
      min: 2,         // keep a couple warm
      acquire: 60000, // wait up to 60s for a free connection
      idle: 10000,    // release if idle for 10s
    },

    // Guard against very slow queries holding connections forever
    dialectOptions: {
      statement_timeout: 15000,                    // cancel server-side after 15s
      idle_in_transaction_session_timeout: 15000,  // end idle tx sessions after 15s
    },

    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false,
    },

    retry: {
      max: 3,
    },
  }
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    throw error;
  }
};

module.exports = sequelize;
module.exports.testConnection = testConnection;
