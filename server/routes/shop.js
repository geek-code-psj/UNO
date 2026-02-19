// server/routes/shop.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authMiddleware } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// GET /api/shop/items
router.get('/items', (req, res) => {
    try {
        const items = db.prepare('SELECT * FROM cosmetics ORDER BY type, price').all();
        res.json({ items });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load shop' });
    }
});

// POST /api/shop/buy
router.post('/buy', authMiddleware, (req, res) => {
    try {
        const { itemId } = req.body;
        if (!itemId) return res.status(400).json({ error: 'Item ID required' });

        const item = db.prepare('SELECT * FROM cosmetics WHERE id = ?').get(itemId);
        if (!item) return res.status(404).json({ error: 'Item not found' });

        // Check if already owned
        const owned = db.prepare('SELECT * FROM user_cosmetics WHERE user_id = ? AND cosmetic_id = ?')
            .get(req.user.id, itemId);
        if (owned) return res.status(409).json({ error: 'Already owned' });

        // Check balance
        const user = User.findById(req.user.id);
        if (user.coins < item.price) {
            return res.status(400).json({ error: 'Not enough coins', needed: item.price, have: user.coins });
        }

        // Purchase
        User.updateCoins(req.user.id, -item.price);
        db.prepare('INSERT INTO user_cosmetics (user_id, cosmetic_id) VALUES (?, ?)').run(req.user.id, itemId);
        Transaction.create(req.user.id, item.price, 'spend', `Purchased: ${item.name}`);

        const updatedUser = User.findById(req.user.id);
        res.json({ success: true, item, remainingCoins: updatedUser.coins });
    } catch (err) {
        console.error('Shop buy error:', err);
        res.status(500).json({ error: 'Purchase failed' });
    }
});

// GET /api/shop/inventory
router.get('/inventory', authMiddleware, (req, res) => {
    try {
        const items = db.prepare(`
      SELECT c.* FROM cosmetics c
      JOIN user_cosmetics uc ON c.id = uc.cosmetic_id
      WHERE uc.user_id = ?
      ORDER BY c.type, uc.purchased_at DESC
    `).all(req.user.id);
        res.json({ items });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load inventory' });
    }
});

// POST /api/shop/equip
router.post('/equip', authMiddleware, (req, res) => {
    try {
        const { itemId } = req.body;
        if (!itemId) return res.status(400).json({ error: 'Item ID required' });

        // Verify ownership
        const owned = db.prepare('SELECT * FROM user_cosmetics WHERE user_id = ? AND cosmetic_id = ?')
            .get(req.user.id, itemId);
        if (!owned) return res.status(403).json({ error: 'Item not owned' });

        const item = db.prepare('SELECT * FROM cosmetics WHERE id = ?').get(itemId);
        User.updateEquipped(req.user.id, item.type, item.id);

        const updatedUser = User.findById(req.user.id);
        res.json({ success: true, user: updatedUser });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/shop/transactions
router.get('/transactions', authMiddleware, (req, res) => {
    try {
        const transactions = Transaction.getByUser(req.user.id);
        res.json({ transactions });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load transactions' });
    }
});

module.exports = router;
