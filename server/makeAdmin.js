// server/makeAdmin.js
require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

// Database connection
const sequelize = new Sequelize('flux_network', 'postgres', '1234', {
  host: 'localhost',
  port: 5432,
  dialect: 'postgres',
  logging: false,
});

async function makeAdmin(email) {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('📡 Connected to PostgreSQL');

    // Update user role to admin
    const [results, metadata] = await sequelize.query(
      'UPDATE users SET role = :role WHERE email = :email',
      {
        replacements: { role: 'admin', email: email },
        type: sequelize.QueryTypes.UPDATE
      }
    );

    if (metadata.rowCount === 0) {
      console.log(`❌ User with email ${email} not found`);
      return;
    }

    console.log(`✅ User ${email} is now an admin!`);
    console.log(`📊 Updated ${metadata.rowCount} user(s)`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('❓ Usage: node makeAdmin.js <email>');
  console.log('📧 Example: node makeAdmin.js kdindxb@gmail.com');
  process.exit(1);
}

makeAdmin(email);