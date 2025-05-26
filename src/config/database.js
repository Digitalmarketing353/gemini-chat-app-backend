// src/config/database.js
'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config(); // Ensure .env variables are loaded

const dbUrl = process.env.DATABASE_URL || 'sqlite:./data/chat_app_dev.sqlite';
let sequelizeInstance;

if (dbUrl.startsWith('sqlite:')) {
  sequelizeInstance = new Sequelize(dbUrl, {
    dialect: 'sqlite',
    storage: dbUrl.substring(7), // Extract path for SQLite storage property
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  });
} else if (dbUrl.startsWith('postgres://')) {
  // Example for PostgreSQL, adjust if you use it later
  sequelizeInstance = new Sequelize(dbUrl, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: process.env.DB_SSL_REQUIRED !== 'false' ? {
        require: true,
        rejectUnauthorized: false // Common for managed DBs, check provider
      } : false
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  });
} else {
  throw new Error('Unsupported DATABASE_URL format. Please use sqlite: or postgres://');
}

const sequelize = sequelizeInstance;

module.exports = sequelize;