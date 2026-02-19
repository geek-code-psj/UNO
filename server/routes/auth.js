// server/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, authMiddleware } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Username must be 3-20 characters' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check existing
        if (User.findByEmail(email)) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        if (User.findByUsername(username)) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        const user = User.create(username, email, password);
        const token = generateToken(user);
        res.status(201).json({ user: { id: user.id, username: user.username, email: user.email }, token });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = User.findByEmail(email);
        if (!user || !User.verifyPassword(user, password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user);
        const profile = User.findById(user.id);
        res.json({ user: profile, token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/profile
router.get('/profile', authMiddleware, (req, res) => {
    const user = User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, (req, res) => {
    try {
        const { equip_type, equip_id } = req.body;
        if (equip_type && equip_id) {
            User.updateEquipped(req.user.id, equip_type, equip_id);
        }
        const user = User.findById(req.user.id);
        res.json({ user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/auth/daily-bonus
router.post('/daily-bonus', authMiddleware, (req, res) => {
    const result = User.claimDailyBonus(req.user.id);
    if (!result.success) return res.status(400).json(result);
    const user = User.findById(req.user.id);
    res.json({ ...result, user });
});

module.exports = router;
