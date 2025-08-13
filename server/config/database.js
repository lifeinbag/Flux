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
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false
    },
    retry: {
      max: 3
    }
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