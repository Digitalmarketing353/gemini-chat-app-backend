// seeders/YYYYMMDDHHMMSS-initial-admin-user.js
'use strict';
const bcrypt = require('bcryptjs');
const path = require('path');
// Ensure .env is loaded correctly relative to project root for seeder
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  async up (queryInterface, Sequelize) {
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin';
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@example.com'; // Must be unique
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin'; // CHANGE THIS IN .env for security

    if ((process.env.INITIAL_ADMIN_PASSWORD || 'admin') === 'admin' && process.env.NODE_ENV !== 'test') {
        console.warn("\n*********************************************************************");
        console.warn("WARNING: Using default 'admin' password for initial admin user.");
        console.warn("Please set INITIAL_ADMIN_PASSWORD in your .env file for better security.");
        console.warn("*********************************************************************\n");
    }


    // Check if admin user already exists by username OR email
    const existingUser = await queryInterface.sequelize.query(
      `SELECT id FROM "Users" WHERE username = :username OR email = :email LIMIT 1`,
      {
        replacements: { username: adminUsername, email: adminEmail },
        type: Sequelize.QueryTypes.SELECT,
        plain: true // Return only the first row as an object, or null
      }
    );

    if (existingUser) {
      console.log(`Admin user with username "${adminUsername}" or email "${adminEmail}" already exists (ID: ${existingUser.id}). Skipping seed.`);
      // Optionally, update existing user to ensure isAdmin is true
      // await queryInterface.bulkUpdate('Users', { isAdmin: true }, { id: existingUser.id });
      // console.log(`Ensured user ID ${existingUser.id} is admin.`);
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    await queryInterface.bulkInsert('Users', [{
      username: adminUsername,
      email: adminEmail,
      password: hashedPassword,
      isAdmin: true,     // <<< This sets the admin rights
      googleId: null,    // No Google ID for this seeded admin by default
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
    console.log(`Seeded initial admin user: ${adminUsername}`);
  },

  async down (queryInterface, Sequelize) {
    const adminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin';
    await queryInterface.bulkDelete('Users', { username: adminUsername }, {});
    console.log(`Removed initial admin user: ${adminUsername}`);
  }
};