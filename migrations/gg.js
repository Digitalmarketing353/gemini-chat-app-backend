// migrations/YYYYMMDDHHMMSS-create-users.js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      username: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: true }, // Allow null for OAuth
      isAdmin: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      email: { type: Sequelize.STRING, allowNull: true, unique: true },     // ADDED HERE
      googleId: { type: Sequelize.STRING, allowNull: true, unique: true },  // ADDED HERE
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Users');
  }
};