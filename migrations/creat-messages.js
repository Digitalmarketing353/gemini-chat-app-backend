'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Messages', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      conversationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Conversations', key: 'id' }, // Foreign key to Conversations
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      role: { type: Sequelize.STRING, allowNull: false }, // 'user' or 'model'
      content: { type: Sequelize.TEXT, allowNull: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
  },
  async down(queryInterface, Sequelize) { await queryInterface.dropTable('Messages'); }
};