// src/models/User.js
'use strict';

const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => { // Accepts the sequelize instance from models/index.js
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle if associations are defined in models/index.js.
     */
    static associate(models) {
      // Define associations here if you choose to, e.g.:
      // this.hasMany(models.Conversation, {
      //   foreignKey: 'userId',
      //   as: 'conversations',
      //   onDelete: 'CASCADE'
      // });
    }

    /**
     * Validates a given password against the user's hashed password.
     * @param {string} password - The password to validate.
     * @returns {Promise<boolean>} - True if the password is valid, false otherwise.
     */
    async isValidPassword(password) {
      // If this user was created via OAuth and has no local password set (this.password is null),
      // local password validation should fail.
      if (!this.password) {
        return false;
      }
      return bcrypt.compare(password, this.password);
    }
  }

  User.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: {
        name: 'unique_username_constraint', // Naming the constraint can be helpful for debugging
        msg: 'This username is already taken.'
      },
      validate: {
        notEmpty: { msg: "Username cannot be empty." },
        len: { args: [3, 30], msg: "Username must be between 3 and 30 characters." }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true, // True if email is optional for local registration or user comes from OAuth without it (though Google provides it)
      unique: {
        name: 'unique_email_constraint',
        msg: 'This email address is already registered.'
      },
      validate: {
        isEmail: { msg: "Please provide a valid email address." }
        // If allowNull is false, add: notEmpty: { msg: "Email cannot be empty." }
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true, // IMPORTANT: Allow NULL if users can sign up/in via OAuth without a local password
                       // If a user only uses Google Sign-In, this field can be NULL in your database.
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    googleId: { // For Google OAuth
      type: DataTypes.STRING,
      allowNull: true,
      unique: {
        name: 'unique_googleId_constraint',
        msg: 'This Google account is already linked to another user.'
      }
    }
    // Optional fields you might consider adding later with migrations:
    // isVerified: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
    // authProvider: { type: DataTypes.STRING, allowNull: true }, // e.g., 'local', 'google'
    // lastLoginAt: { type: DataTypes.DATE }
  }, {
    sequelize,        // Pass the sequelize instance
    modelName: 'User',  // It's convention to use singular for modelName
                        // Sequelize will pluralize it for the table name (Users) by default
    timestamps: true,   // Enable createdAt and updatedAt columns
    hooks: {
      beforeCreate: async (user, options) => {
        // Only hash password if it's provided (i.e., not an OAuth-only user without a local password)
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user, options) => {
        // Only hash password if it has changed and is provided
        if (user.changed('password') && user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });

  return User;
};