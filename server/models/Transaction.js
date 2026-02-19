// server/models/Transaction.js
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Transaction = {
    create(userId, amount, type, reason) {
        const id = uuidv4();
        db.prepare(`
      INSERT INTO transactions (id, user_id, amount, type, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, amount, type, reason);
        return { id, userId, amount, type, reason };
    },

    getByUser(userId, limit = 50) {
        return db.prepare(`
      SELECT * FROM transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit);
    },
};

module.exports = Transaction;
