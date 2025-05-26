// src/app.js
'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const expressEjsLayouts = require('express-ejs-layouts');

// Import route handlers
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Core Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- EJS View Engine and Layout Setup (for Admin Panel) ---
app.use(expressEjsLayouts);
app.set('layout', 'admin/layout'); // Default layout for admin EJS pages
app.set('views', path.join(__dirname, 'views')); // Location of EJS templates
app.set('view engine', 'ejs');

// --- Static Files for Admin Panel ---
const adminStaticPath = path.join(__dirname, '..', 'public_admin'); // Assumes public_admin in project root
console.log(`Serving ADMIN static files for /admin/static from: ${adminStaticPath}`);
app.use('/admin/static', express.static(adminStaticPath));

// --- API and Admin Page Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/admin', adminRoutes); // Admin EJS pages and admin APIs are served from here

// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// +++ START: NEW CODE FOR SERVING USER-FACING FRONTEND       +++
// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

// Define the path to your user frontend files (project root)
const userFrontendPath = path.join(__dirname, '..'); // This resolves to your project root directory
console.log(`Serving USER frontend static files (like style.css, app.js) from: ${userFrontendPath}`);

// Middleware to serve static files (CSS, JS, images) for the user frontend
// This will serve files directly from the project root if they match.
// e.g., a request for /style.css will serve C:\Users\akele\gemini\style.css
app.use(express.static(userFrontendPath));
// src/app.js
// ...
const session = require('express-session');
const passport = require('passport');
require('./config/passport-setup'); // This will run the passport.use() configuration

// ...
// Session middleware (needed by Passport for OAuth flow, even if you issue JWTs after)
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_very_secret_session_key', // Store in .env
    resave: false,
    saveUninitialized: false, // True if you want to save session for unauth users
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));
require('./config/passport-setup');
// Initialize Passport
app.use(passport.initialize());
app.use(passport.session()); // If using persistent login sessions with Passport
// ...
// Route to serve the main index.html for the user-facing single-page application
// This should come AFTER your API routes and specific static routes (like /admin/static)
// to ensure it doesn't override them.
app.get(['/', '/chat-app', '/index.html'], (req, res) => { // Match root, /chat-app, or /index.html explicitly
    res.sendFile(path.join(userFrontendPath, 'index.html'));
});

// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// +++ END: NEW CODE FOR SERVING USER-FACING FRONTEND         +++
// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


// Original root route - this will likely be overridden by the app.get('/') above serving index.html
// You can remove this or keep it; if index.html is served for '/', this won't be hit.
// app.get('/', (req, res) => {
//   res.send(`Conversational AI Backend is running!`);
// });

// --- Catch-all for 404 Not Found ---
// This should be placed after all other routes and static file handlers
app.use((req, res, next) => {
  // Check if it's likely an API request that wasn't matched
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ message: "API endpoint not found." });
  }
  // For any other unhandled GET requests that are not API calls,
  // you might want to redirect to your main frontend app (index.html)
  // if you're building a Single Page Application that handles its own routing.
  // For now, a simple 404 page is fine.
  res.status(404).send("Sorry, the page you are looking for does not exist!");
});

// --- Global Error Handler ---
// This should be the very last piece of middleware
app.use((err, req, res, next) => {
  console.error("Global Error Handler caught an error:", err.stack);
  const statusCode = err.status || 500;

  // Differentiate response type based on what the client accepts or URL structure
  if (req.originalUrl.startsWith('/admin') && !req.originalUrl.startsWith('/admin/api') && req.accepts('html')) {
      // Error occurred while rendering or processing an admin EJS page
      res.status(statusCode).render('admin/errorPage', { // Ensure you have this EJS template
          title: `Error ${statusCode}`,
          message: err.message || 'An unexpected error occurred in the admin panel.',
          errorDetails: process.env.NODE_ENV === 'development' ? err.stack : 'No details available.',
          loggedInUser: req.user // If req.user is available from auth middleware
      });
  } else if (req.originalUrl.startsWith('/api/')) {
      // Error from an API endpoint
      res.status(statusCode).json({
          message: err.message || 'An API error occurred.',
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
  } else {
      // Generic error for other types of requests (e.g., direct static file errors if not 404)
      res.status(statusCode).send(`Server Error: ${err.message || 'Something went wrong!'}`);
  }
});

module.exports = { app };