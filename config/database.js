// src/config/database.js
'use strict';

const { Sequelize } = require('sequelize');
// Load .env ONLY if not in production, as production should use platform-injected env vars
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const dbUrl = process.env.DATABASE_URL;
let sequelizeInstance;

// Default to local dev SQLite if DATABASE_URL is not set (e.g. during local 'npm start' without .env)
if (!dbUrl && process.env.NODE_ENV === 'development') {
    console.warn('[DB Config] DATABASE_URL not set, defaulting to local SQLite for development.');
    sequelizeInstance = new Sequelize('sqlite:./data/chat_app_dev.sqlite', {
        dialect: 'sqlite',
        storage: './data/chat_app_dev.sqlite', // Ensure this path is gitignored
        logging: console.log, // Log SQL in dev
    });
} else if (dbUrl && dbUrl.startsWith('sqlite:')) {
    console.log(`[DB Config] Using SQLite: ${dbUrl}`);
    sequelizeInstance = new Sequelize(dbUrl, {
        dialect: 'sqlite',
        storage: dbUrl.substring(7), // Path for the SQLite file
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
    });
} else if (dbUrl && dbUrl.startsWith('postgres://')) {
    console.log(`[DB Config] Using PostgreSQL: ${dbUrl.split('@')[1]}`); // Log host part, not full creds
    let dialectOptions = {};
    // Configure SSL for PostgreSQL in production or if explicitly set
    if (process.env.NODE_ENV === 'production' || process.env.DB_SSL_REQUIRED === 'true') {
        dialectOptions.ssl = {
            require: true,
            // Heroku, Railway, and many others use self-signed certs or require this
            rejectUnauthorized: false
        };
        console.log("[DB Config] PostgreSQL SSL enabled (require: true, rejectUnauthorized: false)");
    } else {
        console.log("[DB Config] PostgreSQL SSL not explicitly enabled for this environment.");
    }
    sequelizeInstance = new Sequelize(dbUrl, {
        dialect: 'postgres',
        protocol: 'postgres',
        dialectOptions: dialectOptions,
        logging: process.env.SEQUELIZE_LOGGING === 'true' ? msg => console.log(`[DB:${process.env.NODE_ENV || 'dev'}] ${msg}`) : false,
    });
} else {
    console.error('[DB Config] FATAL: DATABASE_URL is not defined or is in an unsupported format.');
    console.error('[DB Config] Please set DATABASE_URL to a valid sqlite: or postgres:// connection string.');
    // For a production Docker image, you might want it to fail hard if DB_URL is missing.
    // For local dev, it might fall back to a default if you prefer.
    if (process.env.NODE_ENV === 'production') {
        throw new Error('DATABASE_URL is missing or invalid in production environment.');
    } else {
        // Fallback for local dev if you absolutely need a default when .env is missing
        console.warn('[DB Config] CRITICAL: DATABASE_URL missing or invalid. Attempting fallback to default local dev SQLite.');
        sequelizeInstance = new Sequelize('sqlite:./data/chat_app_default_dev.sqlite', {
            dialect: 'sqlite', storage: './data/chat_app_default_dev.sqlite', logging: console.log
        });
    }
}

module.exports = sequelizeInstance;