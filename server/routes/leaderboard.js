// server/routes/leaderboard.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// GET /api/leaderboard?sort=wins|winrate|games
router.get('/', optionalAuth, (req, res) => {
    try {
        const sortBy = req.query.sort || 'wins';
        const leaderboard = User.getLeaderboard(sortBy, 100);
        res.json({ leaderboard });
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

// GET /api/leaderboard/me
router.get('/me', authMiddleware, (req, res) => {
    try {
        const rank = User.getPlayerRank(req.user.id);
        if (!rank) return res.json({ rank: null, message: 'Play a game to appear on the leaderboard' });
        res.json({ rank });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get rank' });
    }
});

module.exports = router;
