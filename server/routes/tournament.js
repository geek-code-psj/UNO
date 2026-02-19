// server/routes/tournament.js
const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const { authMiddleware } = require('../middleware/auth');

// GET /api/tournament/list
router.get('/list', (req, res) => {
    try {
        const status = req.query.status || null;
        const tournaments = Tournament.list(status);
        res.json({ tournaments });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list tournaments' });
    }
});

// POST /api/tournament/create
router.post('/create', authMiddleware, (req, res) => {
    try {
        const { name, maxPlayers, entryFee, startsAt } = req.body;
        if (!name) return res.status(400).json({ error: 'Tournament name required' });

        const tournament = Tournament.create(
            name,
            maxPlayers || 8,
            entryFee || 0,
            req.user.id,
            startsAt
        );
        res.status(201).json({ tournament });
    } catch (err) {
        console.error('Tournament create error:', err);
        res.status(500).json({ error: 'Failed to create tournament' });
    }
});

// POST /api/tournament/join/:id
router.post('/join/:id', authMiddleware, (req, res) => {
    try {
        const result = Tournament.join(req.params.id, req.user.id);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to join tournament' });
    }
});

// GET /api/tournament/:id
router.get('/:id', (req, res) => {
    try {
        const tournament = Tournament.findById(req.params.id);
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

        const players = Tournament.getPlayers(req.params.id);
        const bracket = tournament.bracket ? JSON.parse(tournament.bracket) : [];

        res.json({ tournament, players, bracket });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get tournament' });
    }
});

// POST /api/tournament/:id/start
router.post('/:id/start', authMiddleware, (req, res) => {
    try {
        const tournament = Tournament.findById(req.params.id);
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
        if (tournament.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Only the creator can start the tournament' });
        }

        const result = Tournament.generateBracket(req.params.id);
        if (!result.success) return res.status(400).json(result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to start tournament' });
    }
});

module.exports = router;
