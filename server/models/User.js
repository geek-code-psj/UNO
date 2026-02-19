// server/models/User.js
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const User = {
    create(username, email, password) {
        const id = uuidv4();
        const password_hash = bcrypt.hashSync(password, 10);
        db.prepare(`
      INSERT INTO users (id, username, email, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(id, username, email, password_hash);
        return { id, username, email };
    },

    findByEmail(email) {
        return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    },

    findById(id) {
        return db.prepare('SELECT id, username, email, coins, wins, losses, games_played, equipped_card_back, equipped_avatar, equipped_theme, last_daily_bonus, created_at FROM users WHERE id = ?').get(id);
    },

    findByUsername(username) {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    },

    verifyPassword(user, password) {
        return bcrypt.compareSync(password, user.password_hash);
    },

    updateCoins(id, amount) {
        db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(amount, id);
    },

    updateEquipped(id, type, itemId) {
        const column = `equipped_${type}`;
        const allowed = ['equipped_card_back', 'equipped_avatar', 'equipped_theme'];
        if (!allowed.includes(column)) throw new Error('Invalid cosmetic type');
        db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).run(itemId, id);
    },

    getLeaderboard(sortBy = 'wins', limit = 100) {
        const allowed = { wins: 'wins', winrate: 'CAST(wins AS FLOAT) / MAX(games_played, 1)', games: 'games_played' };
        const orderExpr = allowed[sortBy] || 'wins';
        return db.prepare(`
      SELECT id, username, wins, losses, games_played,
        ROUND(CAST(wins AS FLOAT) / MAX(games_played, 1) * 100, 1) as win_rate
      FROM users
      WHERE games_played > 0
      ORDER BY ${orderExpr} DESC
      LIMIT ?
    `).all(limit);
    },

    getPlayerRank(userId) {
        const ranking = db.prepare(`
      SELECT id, username, wins, ROW_NUMBER() OVER (ORDER BY wins DESC) as rank
      FROM users WHERE games_played > 0
    `).all();
        return ranking.find(r => r.id === userId) || null;
    },

    claimDailyBonus(id) {
        const user = db.prepare('SELECT last_daily_bonus FROM users WHERE id = ?').get(id);
        const today = new Date().toISOString().split('T')[0];
        if (user.last_daily_bonus === today) {
            return { success: false, error: 'Already claimed today' };
        }
        db.prepare('UPDATE users SET coins = coins + 20, last_daily_bonus = ? WHERE id = ?').run(today, id);
        db.prepare(`INSERT INTO transactions (id, user_id, amount, type, reason) VALUES (?, ?, 20, 'earn', 'Daily login bonus')`).run(uuidv4(), id);
        return { success: true, amount: 20 };
    },
};

module.exports = User;
