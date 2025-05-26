// src/routes/adminRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // Needed for signing tokens on login
const { User, Conversation, Message } = require('../models'); // Your Sequelize models

// Import ALL necessary middleware functions
const { protectApi, protectFromCookie, isAdminRole } = require('../middleware/authMiddleware');

// --- ADMIN LOGIN, LOGOUT (Publicly Accessible within /admin) ---

// GET route to display the admin login page
router.get('/login', (req, res) => {
    // If user is already logged in as admin, redirect to dashboard
    if (req.cookies.admin_token) {
        try {
            const decoded = jwt.verify(req.cookies.admin_token, process.env.JWT_SECRET);
            if (decoded && decoded.isAdmin) { // Check if the existing token is for an admin
                return res.redirect('/admin/dashboard');
            }
        } catch (e) {
            // Invalid token, proceed to show login page
            res.clearCookie('admin_token');
        }
    }
    res.render('admin/adminLogin', { 
        title: 'Admin Login', 
        error: req.query.error || null, // Display error message from query param if any
        message: req.query.message || null 
    });
});

// POST route to handle admin login attempt
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).render('admin/adminLogin', { title: 'Admin Login', error: 'Username and password are required.' });
        }

        const user = await User.findOne({ where: { username } });
        if (!user || !(await user.isValidPassword(password))) {
            return res.status(401).render('admin/adminLogin', { title: 'Admin Login', error: 'Invalid username or password.' });
        }

        if (!user.isAdmin) {
            return res.status(403).render('admin/adminLogin', { title: 'Admin Login', error: 'Access denied. Not an admin user.' });
        }

        // User is a valid admin, create JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, isAdmin: user.isAdmin }, // Include isAdmin in JWT payload
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );

        // Set JWT in an HTTP-only cookie
        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Only over HTTPS in production
            maxAge: (parseInt(process.env.JWT_COOKIE_EXPIRES_IN_HOURS) || 1) * 60 * 60 * 1000, // e.g., 1 hour
            path: '/admin' // Scope cookie to /admin paths for better security
        });
        
        const returnTo = req.query.returnTo || '/admin/dashboard';
        res.redirect(returnTo);

    } catch (error) {
        console.error("Admin login POST error:", error);
        res.status(500).render('admin/adminLogin', { title: 'Admin Login', error: 'An internal server error occurred during login.' });
    }
});

// Admin logout route
router.get('/logout', (req, res) => {
    res.clearCookie('admin_token', { path: '/admin' }); // Clear the admin token cookie, specify path
    res.redirect('/admin/login?message=LoggedOut');
});


// --- PROTECTED ADMIN ROUTES ---
// All routes below this point require the user to be authenticated (via cookie) AND be an admin.
router.use(protectFromCookie, isAdminRole);

// Admin Dashboard Page
router.get('/dashboard', (req, res) => {
    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        loggedInUser: req.user // req.user is set by protectFromCookie
    });
});

// Users List Page
router.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'createdAt', 'isAdmin'],
            order: [['createdAt', 'DESC']]
        });
        res.render('admin/users', {
            title: 'Manage Users',
            users: users,
            loggedInUser: req.user
        });
    } catch (error) {
        console.error("Admin Panel - Error fetching users:", error);
        res.status(500).render('admin/errorPage', { title: 'Error', message: 'Could not load users list.', loggedInUser: req.user, errorDetails: error.message });
    }
});

// Conversations for a Specific User Page
router.get('/users/:userId/conversations', async (req, res) => {
    try {
        const { userId } = req.params;
        const targetUser = await User.findByPk(userId, { attributes: ['id', 'username'] });

        if (!targetUser) {
            return res.status(404).render('admin/errorPage', { title: 'Error', message: 'User not found.', loggedInUser: req.user });
        }

        const conversations = await Conversation.findAll({
            where: { userId: targetUser.id },
            order: [['updatedAt', 'DESC']],
            attributes: ['id', 'title', 'updatedAt', 'createdAt']
        });

        res.render('admin/userConversations', {
            title: `Conversations for ${targetUser.username}`,
            targetUser: targetUser,
            conversations: conversations,
            loggedInUser: req.user
        });
    } catch (error) {
        console.error(`Admin Panel - Error fetching conversations for user ${req.params.userId}:`, error);
        res.status(500).render('admin/errorPage', { title: 'Error', message: 'Could not load user conversations.', loggedInUser: req.user, errorDetails: error.message });
    }
});

// Messages for a Specific Conversation Page
router.get('/conversations/:conversationId/messages', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const conversation = await Conversation.findByPk(conversationId, {
            include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
        });

        if (!conversation) {
            return res.status(404).render('admin/errorPage', { title: 'Error', message: 'Conversation not found.', loggedInUser: req.user });
        }

        const messages = await Message.findAll({
            where: { conversationId: conversation.id },
            order: [['createdAt', 'ASC']],
            attributes: ['id', 'role', 'content', 'createdAt']
        });

        res.render('admin/conversationMessages', {
            title: `Messages in "${conversation.title}"`,
            conversation: conversation,
            messages: messages,
            loggedInUser: req.user
        });
    } catch (error) {
        console.error(`Admin Panel - Error fetching messages for conversation ${req.params.conversationId}:`, error);
        res.status(500).render('admin/errorPage', { title: 'Error', message: 'Could not load conversation messages.', loggedInUser: req.user, errorDetails: error.message });
    }
});

router.get('/dashboard', (req, res) => {
    res.render('admin/dashboard', { // Just render the child view
        title: 'Admin Dashboard',     // This title will be available in layout.ejs
        loggedInUser: req.user
    });
});

router.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({ /* ... */ });
        res.render('admin/users', { // Just render the child view
            title: 'Manage Users',
            users: users,
            loggedInUser: req.user
        });
    } catch (error) { /* ... */ }
});
// --- ADMIN API Endpoints ---
// These are also protected by the router.use(protectFromCookie, isAdminRole) above.
// If your admin panel's client-side JS needs to make API calls, it will benefit from the cookie auth.

router.get('/api/users', async (req, res) => {
    try {
      const users = await User.findAll({ attributes: ['id', 'username', 'createdAt', 'isAdmin'] });
      res.json(users);
    } catch (error) {
      console.error("Admin API - Error fetching users:", error);
      res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
});

router.get('/users/:userId/conversations', async (req, res) => {
    try {
        const { userId } = req.params;
        const targetUser = await User.findByPk(userId, { attributes: ['id', 'username'] });

        if (!targetUser) {
            return res.status(404).render('admin/errorPage', { 
                title: 'Error - User Not Found', 
                message: 'The requested user could not be found.', 
                loggedInUser: req.user 
            });
        }

        const conversations = await Conversation.findAll({
            where: { userId: targetUser.id }, // Correctly using targetUser.id
            order: [['updatedAt', 'DESC']],
            attributes: ['id', 'title', 'updatedAt', 'createdAt']
        });

        res.render('admin/userConversations', { // Renders userConversations.ejs
            title: `Conversations for ${targetUser.username}`,
            targetUser: targetUser,     // Pass the user whose conversations these are
            conversations: conversations, // Pass the list of conversations
            loggedInUser: req.user      // Pass the currently logged-in admin
        });
    } catch (error) {
        console.error(`Admin Panel - Error fetching conversations for user ${req.params.userId}:`, error);
        res.status(500).render('admin/errorPage', { 
            title: 'Server Error', 
            message: 'Could not load user conversations due to a server error.', 
            loggedInUser: req.user, 
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
});


router.get('/conversations/:conversationId/messages', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const conversation = await Conversation.findByPk(conversationId, {
            // Eager load the User model associated with this conversation
            // Ensure you have defined the 'user' alias in your Conversation.belongsTo(User, { as: 'user' }) association
            include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
        });

        if (!conversation) {
            return res.status(404).render('admin/errorPage', { 
                title: 'Error - Conversation Not Found', 
                message: 'The requested conversation could not be found.', 
                loggedInUser: req.user 
            });
        }

        const messages = await Message.findAll({
            where: { conversationId: conversation.id }, // Correctly using conversation.id
            order: [['createdAt', 'ASC']],
            attributes: ['id', 'role', 'content', 'createdAt']
        });

        res.render('admin/conversationMessages', { // Renders conversationMessages.ejs
            title: `Messages in "${conversation.title}"`,
            conversation: conversation, // Pass the conversation object (includes user details now)
            messages: messages,         // Pass the list of messages
            loggedInUser: req.user      // Pass the currently logged-in admin
        });
    } catch (error) {
        console.error(`Admin Panel - Error fetching messages for conversation ${req.params.conversationId}:`, error);
        res.status(500).render('admin/errorPage', { 
            title: 'Server Error', 
            message: 'Could not load conversation messages due to a server error.', 
            loggedInUser: req.user, 
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
});


module.exports = router;