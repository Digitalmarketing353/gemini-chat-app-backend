// src/models/Conversation.js
'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => { // Accepts the sequelize instance
  class Conversation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define association here
      // Example: Conversation.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      // Example: Conversation.hasMany(models.Message, { foreignKey: 'conversationId', as: 'messages' });
    }
  }

  Conversation.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      // References User model's id.
      // Note: The actual foreign key constraint is typically defined in a migration
      // or through the association definition in models/index.js.
      // Sequelize uses this for association understanding.
      references: {
        model: 'Users', // This should match the table name for Users
        key: 'id'
      },
      // onDelete: 'CASCADE' // Usually defined in migration or association
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'New Conversation',
      validate: {
        notEmpty: { msg: "Conversation title cannot be empty." }
      }
    }
  }, {
    sequelize,
    modelName: 'Conversation',
    timestamps: true,
  });

  return Conversation;
};