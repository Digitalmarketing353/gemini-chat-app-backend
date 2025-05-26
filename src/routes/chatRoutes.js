// src/routes/chatRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Import the 'protectUserApp' middleware which checks cookies AND Bearer token
const { protectUserApp } = require('../middleware/authMiddleware');

// Apply the 'protectUserApp' middleware to all routes in this file
router.use(protectUserApp); // <<<< CHANGE THIS from protectApi to protectUserApp

// Define your chat routes
router.get('/conversations', chatController.getConversations);
router.get('/conversations/:conversationId/messages', chatController.getMessagesForConversation);
router.post('/stream', chatController.streamChat);

module.exports = router;