// src/models/Message.js
'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => { // Accepts the sequelize instance
  class Message extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define association here
      // Example: Message.belongsTo(models.Conversation, { foreignKey: 'conversationId', as: 'conversation' });
    }
  }

  Message.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Conversations', // This should match the table name for Conversations
        key: 'id'
      },
      // onDelete: 'CASCADE' // Usually defined in migration or association
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: {
          args: [['user', 'model']],
          msg: "Role must be either 'user' or 'model'."
        }
      }
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Message content cannot be empty." }
      }
    }
  }, {
    sequelize,
    modelName: 'Message',
    timestamps: true,
  });

  return Message;
};