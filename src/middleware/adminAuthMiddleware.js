// Example for Option A (using .env credentials)
const adminAuth = (req, res, next) => {
    // This is a very basic example, consider using proper basic auth or session for admin
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Basic ')) {
        const encoded = authHeader.substring(6); // Remove 'Basic '
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        const [username, password] = decoded.split(':');

        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            return next();
        }
    }
    // For API, send 401/403
    if (req.originalUrl.startsWith('/admin/api')) {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); // For browser prompt
        return res.status(401).json({ message: 'Admin authentication required.' });
    }
    // For HTML pages, you might redirect to a login page or send 401
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Admin authentication required.');
};

// Example for Option B (checking req.user.isAdmin from JWT)
const isAdminRole = (req, res, next) => {
    if (req.user && req.user.isAdmin) { // req.user comes from your 'protect' JWT middleware
        return next();
    }
    if (req.originalUrl.startsWith('/admin/api')) {
        return res.status(403).json({ message: 'Forbidden: Admin role required.' });
    }
    return res.status(403).send('Forbidden: Admin role required.');
};

// Choose one method or combine. For now, let's assume Option B is preferred.
// So, your main JWT 'protect' middleware runs first, then this 'isAdminRole'.
module.exports = { isAdminRole };