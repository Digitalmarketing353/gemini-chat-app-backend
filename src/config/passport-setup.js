// src/config/passport-setup.js
'use strict';

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path'); // For resolving .env path

// Correctly load .env variables relative to the project root
// __dirname here is C:\Users\akele\gemini\src\config
// So, '../../.env' goes up two levels to C:\Users\akele\gemini\.env
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Import the entire 'db' object exported by models/index.js
const db = require('../models');
// Access the User model from the db object
const User = db.User;

// Ensure User model is loaded, otherwise critical error
if (!User) {
    throw new Error("User model is not loaded correctly from ../models. Check models/index.js exports.");
}

// --- Passport Session Setup ---
// Used to serialize the user for the session
passport.serializeUser((user, done) => {
    // 'user' here is the user object returned by the GoogleStrategy's verify callback
    done(null, user.id); // Store only the user ID in the session
});

// Used to deserialize the user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user); // User object will be attached to req.user
    } catch (err) {
        done(err, null);
    }
});

// --- Google OAuth 2.0 Strategy ---
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL, // e.g., "http://localhost:3000/api/auth/google/callback"
            scope: ['profile', 'email'], // Permissions to request from Google
            // passReqToCallback: true, // Set to true if you need to access 'req' in the verify callback
        },
        async (accessToken, refreshToken, profile, done) => {
            // This 'verify' callback is triggered after Google successfully authenticates the user.
            // 'profile' contains the user's Google profile information.
            // 'done' is a callback to tell Passport the outcome.
            try {
                // console.log('Google Profile received:', JSON.stringify(profile, null, 2)); // For debugging

                const googleId = profile.id;
                const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
                let displayName = profile.displayName;

                if (!displayName && profile.name) {
                    displayName = `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim();
                }
                // Fallback for display name if still empty
                if (!displayName || displayName.length === 0) {
                    displayName = email ? email.split('@')[0] : `user_${googleId.substring(googleId.length - 6)}`;
                }


                if (!email) {
                    console.error('Google OAuth Strategy: Email not found in Google profile for ID:', googleId);
                    return done(new Error('Email not provided by Google. Cannot proceed.'), false);
                }

                // 1. Find user by Google ID
                let user = await User.findOne({ where: { googleId: googleId } });

                if (user) {
                    // User found with this Google ID - authentication successful
                    console.log(`Google OAuth: User found with Google ID ${googleId} (Email: ${user.email})`);
                    return done(null, user); // Pass the existing user
                }

                // 2. If no user with Google ID, check if an account exists with this email
                user = await User.findOne({ where: { email: email } });

                if (user) {
                    // User with this email exists but not linked to this Google ID yet. Link them.
                    console.log(`Google OAuth: Found user with email ${email}. Linking Google ID ${googleId}.`);
                    user.googleId = googleId;
                    // user.isVerified = true; // Optionally mark email as verified
                    // user.authProvider = 'google'; // Optional: track auth provider
                    await user.save();
                    return done(null, user);
                }

                // 3. No existing user with this Google ID or email - create a new user
                console.log(`Google OAuth: No existing user found. Creating new user for email ${email} and Google ID ${googleId}.`);

                // Generate a unique username
                let usernameBase = displayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'guser';
                if (usernameBase.length === 0) usernameBase = 'guser'; // Ensure base is not empty
                let username = usernameBase;
                let counter = 1;
                // Ensure username is unique in your system
                while (await User.findOne({ where: { username: username } })) {
                    username = `${usernameBase}${counter}`;
                    counter++;
                    if (counter > 100) { // Safety break for username generation
                        console.error("Could not generate a unique username after 100 attempts.");
                        return done(new Error("Failed to generate a unique username."), false);
                    }
                }

                user = await User.create({
                    googleId: googleId,
                    email: email,
                    username: username,
                    password: String(Math.random().toString(36).slice(-8) + Date.now().toString(36)), // Long, random, unguessable password
                    isAdmin: false, // New users via Google are not admins by default
                    // isVerified: true, // Email from Google is generally considered verified
                    // authProvider: 'google', // Optional
                });
                console.log(`Google OAuth: New user created with ID ${user.id}, Username: ${user.username}`);
                return done(null, user);

            } catch (err) {
                console.error('Error in Google OAuth Strategy verify callback:', err);
                return done(err, false); // Pass error to Passport
            }
        }
    )
);

// This file just configures Passport strategies.
// It doesn't export anything itself, but `require('./config/passport-setup')` in app.js will execute this code.
console.log("Passport Google OAuth strategy configured.");