// src/middleware/authMiddleware.js
'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models'); // Assuming User model is exported from models/index.js (e.g., db.User)

/**
 * Middleware to protect API routes expecting a JWT in the Authorization header (Bearer token).
 * Attaches the user object to req.user if authentication is successful.
 */
const protectApi = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found for this token.' });
      }
      return next();
    } catch (error) {
      console.error('API Auth - Token verification error:', error.message);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Not authorized, token expired.' });
      }
      return res.status(401).json({ message: 'Not authorized, token verification failed.' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no Bearer token provided.' });
  }
};

/**
 * Middleware to protect routes by checking for a JWT in an HTTP-only cookie (admin_token).
 * Primarily for server-rendered admin panel pages.
 * Attaches the user object to req.user if authentication is successful.
 */
const protectFromCookie = async (req, res, next) => {
  const token = req.cookies.admin_token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (!req.user) {
        res.clearCookie('admin_token', { path: '/admin' });
        return res.redirect('/admin/login?error=UserNotFoundForToken');
      }
      return next();
    } catch (error) {
      console.error('Admin Cookie Auth - Token verification error:', error.message);
      res.clearCookie('admin_token', { path: '/admin' });
      const errorType = error.name === 'TokenExpiredError' ? 'SessionExpired' : 'InvalidSession';
      return res.redirect(`/admin/login?error=${errorType}`);
    }
  } else {
    const originalUrl = encodeURIComponent(req.originalUrl);
    if (req.path === '/login') return next(); // Avoid redirect loop if on login and no cookie
    return res.redirect(`/admin/login?unauthorized=true&returnTo=${originalUrl === '/admin/' || originalUrl === '/admin' ? '/admin/dashboard' : originalUrl }`);
  }
};

/**
 * Middleware to check if the authenticated user (from req.user) has an admin role.
 * This should run AFTER protectApi or protectFromCookie.
 */
const isAdminRole = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  } else {
    if (req.originalUrl.startsWith('/admin/api/')) {
        return res.status(403).json({ message: 'Forbidden: Admin role required.' });
    }
    return res.status(403).render('admin/errorPage', {
      title: 'Access Denied',
      message: 'You do not have the necessary permissions to view this page.',
      loggedInUser: req.user
    });
  }
};

/**
 * Middleware to protect USER application routes (like /api/chat/*, /api/auth/me)
 * by checking for a JWT in an HTTP-only cookie (app_token) or Bearer token.
 * Attaches the user object to req.user if authentication is successful.
 */
const protectUserApp = async (req, res, next) => {
  let token;

  // 1. Try to get token from 'app_token' cookie
  if (req.cookies && req.cookies.app_token) {
    token = req.cookies.app_token;
    // console.log("protectUserApp: Found token in app_token cookie.");
  }
  // 2. If no cookie, try to get token from Authorization header (for API clients perhaps)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    // console.log("protectUserApp: Found token in Authorization Bearer header.");
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] } // Ensure 'isAdmin' is fetched if needed by downstream
      });

      if (!req.user) {
        console.warn("protectUserApp: User not found for token ID:", decoded.id);
        // Clear cookie if it was the source and it's invalid
        if (req.cookies && req.cookies.app_token) res.clearCookie('app_token', { path: '/' });
        return res.status(401).json({ message: 'Authentication failed: User not found for token.' });
      }
      // console.log("protectUserApp: User authenticated:", req.user.username);
      return next();
    } catch (error) {
      console.error('protectUserApp - Token verification error:', error.message);
      if (req.cookies && req.cookies.app_token) res.clearCookie('app_token', { path: '/' });
      const message = error.name === 'TokenExpiredError' ? 'Token expired.' : 'Token invalid.';
      return res.status(401).json({ message: `Authentication failed: ${message}` });
    }
  } else {
    // console.log("protectUserApp: No token found (cookie or Bearer).");
    return res.status(401).json({ message: 'Not authorized, no token provided.' });
  }
};


module.exports = {
  protectApi,       // For specific APIs if you need a different Bearer token only strategy
  protectFromCookie, // For securing admin panel EJS pages via admin_token cookie
  isAdminRole,      // For checking admin privileges after authentication
  protectUserApp    // For securing user app routes (/api/chat, /api/auth/me) via app_token cookie or Bearer
};