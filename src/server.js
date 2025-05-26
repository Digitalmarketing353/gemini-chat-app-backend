// src/server.js
require('dotenv').config();
const { app } = require('./app'); // Get app from app.js
const { initializeDatabase } = require('./models'); // Get initializeDatabase from models/index.js

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initializeDatabase(); // Call it
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Access it (locally if applicable) at http://localhost:${PORT}`);
      if (process.env.PROJECT_DOMAIN) {
        console.log(`Glitch App URL: https://${process.env.PROJECT_DOMAIN}.glitch.me`);
      }
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Make sure no other instance is running.`);
    }
    process.exit(1);
  }
}

startServer();