// src/routes/authRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport'); // Assuming passport is initialized in app.js or passport-setup.js
const authController = require('../controllers/authController'); // For local register logic
const { User } = require('../models'); // Needed for local login if not fully in controller

// Import the specific middleware for user app protection (cookie/bearer token based)
const { protectUserApp } = require('../middleware/authMiddleware');

// --- Environment-aware Redirect URLs ---
// It's good practice to define these base URLs in .env or default them
const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// The path on your frontend where the main application lives after login/redirect
const FRONTEND_APP_MAIN_PATH = process.env.FRONTEND_URL_APP_PATH || '/chat-app'; // Or just "/" if served at root

// --- Local Authentication Routes ---

// POST /api/auth/register - User registration
// Assuming authController.register handles user creation and response
router.post('/register', authController.register);

// POST /api/auth/login - User login (local username/password)
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }

        const user = await User.findOne({ where: { username } });

        if (!user) {
            console.log(`Login attempt failed: User "${username}" not found.`);
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const isMatch = await user.isValidPassword(password);
        if (!isMatch) {
            console.log(`Login attempt failed: Invalid password for user "${username}".`);
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        // User is valid, create JWT payload
        const payload = {
            id: user.id,
            username: user.username,
            isAdmin: user.isAdmin // Include isAdmin status in JWT
        };
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );

        // Set JWT in an HTTP-only cookie for the user app
        res.cookie('app_token', token, {
            httpOnly: true, // Cannot be accessed by client-side JavaScript
            secure: process.env.NODE_ENV === 'production', // Send only over HTTPS in production
            maxAge: (parseInt(process.env.JWT_COOKIE_EXPIRES_IN_HOURS) || 1) * 60 * 60 * 1000, // e.g., 1 hour
            path: '/' // Cookie available for all paths on your domain
            // sameSite: 'Lax' // Consider SameSite attribute for CSRF protection
        });

        console.log(`User "${username}" logged in successfully. app_token cookie set.`);
        // Send back user info (excluding password) and a success message
        // The token in the response body is optional if frontend relies solely on the cookie
        res.status(200).json({
            message: 'Login successful.',
            user: { // Send essential, non-sensitive user details
                id: user.id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin
            }
            // token: token, // Optionally still send token if other clients (e.g., mobile) need it
        });

    } catch (error) {
        console.error('Local login error:', error);
        res.status(500).json({ message: 'Error logging in.', error: error.message });
    }
});


// --- Google OAuth Routes ---

// GET /api/auth/google - Initiates Google OAuth flow
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email'] // Permissions requested from Google
}));

// GET /api/auth/google/callback - Google redirects here after user authentication
router.get('/google/callback',
    passport.authenticate('google', {
        // Redirect to frontend's root/login on failure, with error query params
        failureRedirect: `${FRONTEND_BASE_URL}/?login_error=google_auth_failed&auth_provider=google`,
        session: false // We are using JWTs/cookies, not server-side sessions for user state
    }),
    (req, res) => {
        // Google authentication was successful.
        // req.user is populated by Passport's verify callback in passport-setup.js
        if (!req.user) {
            // This case should ideally not be reached if failureRedirect works, but as a fallback:
            console.error("Google callback: req.user is missing after successful passport authentication.");
            return res.redirect(`${FRONTEND_BASE_URL}/?login_error=user_processing_failed&auth_provider=google`);
        }

        console.log("Google callback successful. User from Passport:", req.user.username);

        // Create your application's JWT for this user
        const payload = {
            id: req.user.id,
            username: req.user.username,
            isAdmin: req.user.isAdmin
        };
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );

        // Set the JWT in an HTTP-only cookie
        res.cookie('app_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: (parseInt(process.env.JWT_COOKIE_EXPIRES_IN_HOURS) || 1) * 60 * 60 * 1000,
            path: '/'
            // sameSite: 'Lax'
        });

        console.log(`app_token cookie set for Google authenticated user "${req.user.username}". Redirecting to frontend.`);

        // Redirect to the main frontend application page (e.g., where index.html is served)
        // The frontend's app.js will then typically call /api/auth/me to confirm and load user data for the UI.
        res.redirect(`${FRONTEND_BASE_URL}${FRONTEND_APP_MAIN_PATH}`);
    }
);

// --- User State and Logout ---

// GET /api/auth/me - Get current authenticated user's info
// Relies on app_token cookie (via protectUserApp) or Bearer token
router.get('/me', protectUserApp, (req, res) => {
    // protectUserApp middleware has already authenticated the user and attached them to req.user
    // console.log("/api/auth/me called, authenticated user:", req.user.username);
    res.status(200).json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email, // Ensure email is on req.user (fetched by protectUserApp or in JWT)
        isAdmin: req.user.isAdmin // Ensure isAdmin is on req.user
    });
});

// POST /api/auth/logout - User logout
router.post('/logout', (req, res) => {
    // Clear the httpOnly cookie used by the user application
    res.clearCookie('app_token', { path: '/' });
    console.log("User logged out via /api/auth/logout, app_token cookie cleared.");
    res.status(200).json({ message: 'Logout successful' });
});


module.exports = router;