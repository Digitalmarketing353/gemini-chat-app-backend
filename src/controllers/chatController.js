// src/controllers/chatController.js

const { Conversation, Message, User } = require('../models');
const { Op } = require('sequelize');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// --- Variables for Gemini SDK (to be initialized lazily) ---
let genAIInstance;
let geminiModelInstance;

// Helper function to initialize and get the Gemini model instance
const getGeminiModel = () => {
  if (!geminiModelInstance) {
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set in .env file!");
      throw new Error("GEMINI_API_KEY is not configured. Cannot proceed with AI chat.");
    }
    if (!genAIInstance) {
        genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log("GoogleGenerativeAI instance created.");
    }
    try {
        // IMPORTANT: Change this model name to the one that works for your API Key / Project
        // Examples: "gemini-1.5-flash-latest", "gemini-pro", "gemini-2.0-flash" (if that's a valid identifier for you)
        const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash"; // Allow override via .env
        geminiModelInstance = genAIInstance.getGenerativeModel({ model: modelName });
        console.log(`Gemini model ('${geminiModelInstance.model}') initialized successfully via getGeminiModel().`);
    } catch (initError) {
        console.error(`Failed to initialize Gemini Model:`, initError);
        throw initError;
    }
  }
  return geminiModelInstance;
};

// Configuration for Gemini
const generationConfig = {
  temperature: 0.7,
  topP: 0.95,
  maxOutputTokens: 8192,
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- getConversations ---
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
      where: { userId: req.user.id },
      order: [['updatedAt', 'DESC']],
    });
    res.status(200).json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Failed to fetch conversations', error: error.message });
  }
};

// --- getMessagesForConversation ---
exports.getMessagesForConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findOne({
      where: { id: conversationId, userId: req.user.id },
    });
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found or access denied.' });
    }
    const messages = await Message.findAll({
      where: { conversationId: conversationId },
      order: [['createdAt', 'ASC']],
    });
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
  }
};

// --- streamChat (with full Gemini Logic and updatedAt fix) ---
exports.streamChat = async (req, res) => {
  try {
    const activeModel = getGeminiModel(); // Get/Initialize the Gemini model

    const { prompt, conversationId: existingConversationId } = req.body;
    const userId = req.user.id;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let conversation;
    let conversationTitle = "New Conversation";

    if (existingConversationId) {
      conversation = await Conversation.findOne({
        where: { id: existingConversationId, userId: userId },
      });
      if (!conversation) {
        res.write(`data: ${JSON.stringify({ event: "error", message: "Conversation not found or access denied." })}\n\n`);
        return res.end();
      }
      conversationTitle = conversation.title;
    } else {
      const firstWords = prompt.split(' ').slice(0, 5).join(' ');
      conversationTitle = firstWords.length > 30 ? firstWords.substring(0, 27) + "..." : firstWords || "New Chat";
      conversation = await Conversation.create({ userId: userId, title: conversationTitle });
      res.write(`data: ${JSON.stringify({ event: "conversationCreated", conversationId: conversation.id, title: conversation.title })}\n\n`);
    }

    await Message.create({
      conversationId: conversation.id,
      role: 'user',
      content: prompt,
    });

    const dbMessages = await Message.findAll({
      where: { conversationId: conversation.id },
      order: [['createdAt', 'ASC']],
    });

    const geminiHistory = dbMessages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
    
    const chatHistoryForSDK = geminiHistory.slice(0, -1);

    const chat = activeModel.startChat({
      history: chatHistoryForSDK,
      generationConfig: generationConfig,
      safetySettings: safetySettings,
    });

    const result = await chat.sendMessageStream(prompt);

    let fullAiResponse = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullAiResponse += chunkText;
        res.write(`data: ${JSON.stringify({ textChunk: chunkText })}\n\n`);
      }
    }
    
    if (result.response.candidates && result.response.candidates.length > 0) {
        const candidate = result.response.candidates[0];
        if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
            console.warn(`Gemini stream finished with reason: ${candidate.finishReason}`);
            if (!fullAiResponse && candidate.safetyRatings && candidate.safetyRatings.some(r => r.blocked)) {
                res.write(`data: ${JSON.stringify({ event: "error", message: "Response blocked due to safety settings." })}\n\n`);
            } else if (!fullAiResponse) {
                 res.write(`data: ${JSON.stringify({ event: "error", message: `Response generation stopped due to: ${candidate.finishReason}` })}\n\n`);
            }
        }
    } else if (!fullAiResponse && (!result.response.candidates || result.response.candidates.length === 0)) {
        console.warn("Gemini stream ended with no candidates or response text.");
        res.write(`data: ${JSON.stringify({ event: "error", message: "AI response was empty or an error occurred." })}\n\n`);
    }

    let aiMessageId = null;
    if (fullAiResponse.trim()) {
      const aiMessage = await Message.create({
        conversationId: conversation.id,
        role: 'model',
        content: fullAiResponse.trim(),
      });
      aiMessageId = aiMessage.id;
      
      // --- FIX for conversation.touch ---
      conversation.changed('updatedAt', true); // Mark updatedAt as conceptually changed
      await conversation.save({ fields: ['updatedAt'] }); // Tell Sequelize to save and update the timestamp
      // --- END FIX ---

    } else {
      console.log("No AI response content to save. Full AI response was empty or whitespace.");
    }

    res.write(`data: ${JSON.stringify({ event: "done", messageId: aiMessageId, conversationId: conversation.id })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Critical Error in streamChat:', error);
    const errorMessage = error.message || 'An internal server error occurred.';
    let errorDetails = error.cause || (error.details ? error.details : null);
    if (error.name === 'GoogleGenerativeAIError' && error.message.includes("Invalid JSON payload")) {
        errorDetails = error.message;
    }

    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to process chat stream', error: errorMessage, details: errorDetails });
    } else {
      try {
        res.write(`data: ${JSON.stringify({ event: "error", message: errorMessage, details: errorDetails })}\n\n`);
      } catch (sseError) {
        console.error("Failed to send error over SSE:", sseError);
      }
      res.end();
    }
  }
};

// Optional: Log at the end of the module to confirm it loads
console.log("chatController.js module loaded. Controller functions (getConversations, getMessagesForConversation, streamChat) are defined.");