// server/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            // Ignore invalid tokens for optional auth
        }
    }
    next();
}

function verifySocketToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

module.exports = { generateToken, authMiddleware, optionalAuth, verifySocketToken };
