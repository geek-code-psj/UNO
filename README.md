# 🂡 UNO Arena

A real-time multiplayer UNO card game with AI bots, offline play, tournaments, leaderboards, and cosmetics shop — built with Node.js, Express, Socket.IO, and vanilla JavaScript.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

- **🎮 Real-time Multiplayer** — Play UNO with friends via Socket.IO rooms
- **🤖 VS Computer** — Battle AI bots with 3 difficulty levels (Easy, Medium, Hard)
- **📡 Offline Mode** — Full game engine runs in-browser with PWA support — no internet needed
- **📖 Official UNO Rules** — All power cards (Skip, Reverse, Draw Two, Wild, Wild Draw Four) with challenge mechanics
- **🏆 Leaderboards** — Track wins, win rates, and games played
- **🛒 Cosmetics Shop** — Buy card backs, avatars, and themes with in-game coins
- **⚔️ Tournaments** — Create and join bracket-style tournaments
- **💬 In-game Chat** — Text chat and emoji reactions during games
- **🔐 Authentication** — Register/login with JWT, or play as guest

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Server | Express 5, Socket.IO 4 |
| Database | SQLite via better-sqlite3 |
| Auth | JWT + bcryptjs |
| Frontend | Vanilla HTML/CSS/JS |
| Offline | Service Worker + PWA |
| Mobile | Capacitor (Android) |

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 20 or higher
- npm (comes with Node.js)

### Setup

```bash
# Clone the repository
git clone https://github.com/geek-code-psj/UNO.git
cd UNO

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | — | Secret key for JWT tokens |
| `DB_PATH` | `./data/uno.db` | SQLite database path |
| `NODE_ENV` | `development` | Environment mode |

## 📁 Project Structure

```
UNO/
├── server/
│   ├── index.js          # Express + Socket.IO server
│   ├── config/
│   │   └── database.js   # SQLite schema & seeding
│   ├── game/
│   │   ├── GameRoom.js   # Game room logic
│   │   ├── UnoEngine.js  # Core UNO game engine
│   │   ├── BotPlayer.js  # AI bot strategies
│   │   └── constants.js  # Game constants
│   ├── middleware/
│   │   └── auth.js       # JWT authentication
│   ├── models/
│   │   ├── User.js       # User model
│   │   ├── Shop.js       # Shop model
│   │   └── Tournament.js # Tournament model
│   ├── routes/
│   │   ├── auth.js       # Auth endpoints
│   │   ├── leaderboard.js
│   │   ├── shop.js
│   │   └── tournaments.js
│   └── utils/
│       ├── helpers.js
│       └── validators.js
├── public/
│   ├── index.html        # Main game lobby
│   ├── offline.html      # Offline play vs bots
│   ├── rules.html        # Official UNO rules
│   ├── leaderboard.html
│   ├── shop.html
│   ├── tournament.html
│   ├── manifest.json     # PWA manifest
│   ├── sw.js             # Service worker
│   ├── css/styles.css    # Global styles
│   └── js/
│       ├── app.js        # Lobby & auth logic
│       ├── game.js       # Game board rendering
│       ├── chat.js       # In-game chat
│       └── offline-engine.js  # Client-side UNO engine
├── api/
│   └── health.js         # Vercel serverless health check
├── vercel.json           # Vercel deployment config
├── capacitor.config.json # Mobile app config
├── package.json
└── .env.example
```

## 🌐 Deployment

### Vercel (Static/Offline Only)

> ⚠️ **Note**: Vercel does not support WebSockets. Only the offline mode and static pages will work. For full multiplayer, use Render, Railway, or Fly.io.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Render / Railway (Full Multiplayer)

1. Connect your GitHub repo
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables from `.env.example`

### Mobile APK (Android)

```bash
# Install Capacitor
npm run cap:init

# Build Android project
npx cap sync android

# Open in Android Studio
npx cap open android

# Or build APK directly
cd android && ./gradlew assembleDebug
# APK will be at: android/app/build/outputs/apk/debug/app-debug.apk
```

## 🎮 Game Rules

The game follows [official UNO rules](https://www.unorules.com/):

- **Skip** ⛔ — Next player loses their turn
- **Reverse** 🔄 — Reverses play direction (acts as Skip in 2-player)
- **Draw Two** +2 — Next player draws 2 and loses turn
- **Wild** 🌈 — Choose any color
- **Wild Draw Four** +4 — Choose color + next player draws 4 (can be challenged!)
- **UNO Call** — Must say UNO when down to 1 card or draw 2 penalty

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
