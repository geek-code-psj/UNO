// server/config/database.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dbDir, 'uno.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// ── Schema ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    coins INTEGER DEFAULT 100,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    equipped_card_back TEXT DEFAULT 'default',
    equipped_avatar TEXT DEFAULT 'default',
    equipped_theme TEXT DEFAULT 'default',
    last_daily_bonus TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cosmetics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('card_back', 'avatar', 'theme')),
    price INTEGER NOT NULL,
    rarity TEXT DEFAULT 'common' CHECK(rarity IN ('common', 'rare', 'epic', 'legendary')),
    description TEXT DEFAULT '',
    image_key TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS user_cosmetics (
    user_id TEXT NOT NULL,
    cosmetic_id TEXT NOT NULL,
    purchased_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, cosmetic_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (cosmetic_id) REFERENCES cosmetics(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('earn', 'spend')),
    reason TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS game_history (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    players TEXT NOT NULL,
    winner_id TEXT,
    duration_seconds INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'registration' CHECK(status IN ('registration', 'active', 'completed', 'cancelled')),
    max_players INTEGER DEFAULT 8,
    entry_fee INTEGER DEFAULT 0,
    prize_pool INTEGER DEFAULT 0,
    bracket TEXT DEFAULT '[]',
    created_by TEXT NOT NULL,
    starts_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tournament_players (
    tournament_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    seed INTEGER DEFAULT 0,
    eliminated INTEGER DEFAULT 0,
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (tournament_id, user_id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── Seed default cosmetics ──────────────────────────────
const cosmeticCount = db.prepare('SELECT COUNT(*) as c FROM cosmetics').get().c;
if (cosmeticCount === 0) {
  const insert = db.prepare('INSERT INTO cosmetics (id, name, type, price, rarity, description, image_key) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const seedCosmetics = [
    // Card Backs
    ['cb_flame', 'Flame', 'card_back', 50, 'common', 'A fiery card back', '🔥'],
    ['cb_ocean', 'Ocean Wave', 'card_back', 75, 'common', 'Calm ocean waves', '🌊'],
    ['cb_galaxy', 'Galaxy', 'card_back', 150, 'rare', 'Stars and nebulae', '🌌'],
    ['cb_diamond', 'Diamond', 'card_back', 300, 'epic', 'Sparkling diamonds', '💎'],
    ['cb_dragon', 'Dragon', 'card_back', 500, 'legendary', 'Ancient dragon scale', '🐉'],
    // Avatars
    ['av_ninja', 'Ninja', 'avatar', 50, 'common', 'Silent warrior', '🥷'],
    ['av_robot', 'Robot', 'avatar', 75, 'common', 'Beep boop', '🤖'],
    ['av_wizard', 'Wizard', 'avatar', 150, 'rare', 'Master of cards', '🧙'],
    ['av_alien', 'Alien', 'avatar', 300, 'epic', 'From another world', '👽'],
    ['av_crown', 'Royal', 'avatar', 500, 'legendary', 'King of UNO', '👑'],
    // Themes
    ['th_neon', 'Neon Glow', 'theme', 100, 'common', 'Cyberpunk vibes', '💜'],
    ['th_forest', 'Enchanted Forest', 'theme', 200, 'rare', 'Magical woodland', '🌲'],
    ['th_gold', 'Golden Luxury', 'theme', 400, 'epic', 'Pure gold aesthetic', '✨'],
    ['th_void', 'The Void', 'theme', 750, 'legendary', 'Embrace the darkness', '🕳️'],
  ];
  const insertMany = db.transaction((items) => {
    for (const item of items) insert.run(...item);
  });
  insertMany(seedCosmetics);
}

module.exports = db;
