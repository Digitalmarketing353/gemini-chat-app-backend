// src/models/index.js
'use strict';

const fs = require('fs'); // Not strictly needed for this version, but often present in boilerplate
const path = require('path'); // Not strictly needed for this version, but often present
const Sequelize = require('sequelize'); // Import Sequelize class for DataTypes and other utilities
const process = require('process'); // For accessing environment variables
const basename = path.basename(__filename); // Not strictly needed
const env = process.env.NODE_ENV || 'development';

// Assuming your sequelize CLI config (config/config.json) is set up,
// but for application runtime, we'll use our own sequelize instance from ../config/database.js
// This avoids relying on the CLI's config structure directly in the app, offering more flexibility.
const sequelize = require('../config/database'); // Your custom Sequelize instance setup

// Define the initializeDatabase function separately
// This function will only authenticate the connection, as migrations handle the schema.
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully (models/index.js).');
    // Schema management (table creation/alteration) is now handled by Sequelize migrations.
    // DO NOT call sequelize.sync() here if you are using migrations.
  } catch (error) {
    console.error('Unable to connect to the database (models/index.js):', error);
    throw error; // Re-throw the error so server.js can catch it and handle app shutdown
  }
};

// Load model definers
const UserDefiner = require('./User');
const ConversationDefiner = require('./Conversation');
const MessageDefiner = require('./Message');

// Initialize models by calling the definer functions
const User = UserDefiner(sequelize); // Pass the sequelize instance
const Conversation = ConversationDefiner(sequelize);
const Message = MessageDefiner(sequelize);

// Create the db object to hold all models, sequelize instance, and helper functions
const db = {};

db.Sequelize = Sequelize; // The Sequelize library itself (e.g., for Sequelize.Op)
db.sequelize = sequelize; // The configured Sequelize instance

// Add models to the db object
db.User = User;
db.Conversation = Conversation;
db.Message = Message;

// Define associations between models
if (db.User && db.Conversation) {
  db.User.hasMany(db.Conversation, {
    foreignKey: 'userId',
    as: 'conversations', // Optional alias
    onDelete: 'CASCADE'  // If a user is deleted, their conversations are also deleted
  });
  db.Conversation.belongsTo(db.User, {
    foreignKey: 'userId',
    as: 'user' // Optional alias
  });
}

if (db.Conversation && db.Message) {
  db.Conversation.hasMany(db.Message, {
    foreignKey: 'conversationId',
    as: 'messages', // Optional alias
    onDelete: 'CASCADE'  // If a conversation is deleted, its messages are also deleted
  });
  db.Message.belongsTo(db.Conversation, {
    foreignKey: 'conversationId',
    as: 'conversation' // Optional alias
  });
}

// Add the initializeDatabase function to the db object
db.initializeDatabase = initializeDatabase;

// Export the db object
module.exports = db;