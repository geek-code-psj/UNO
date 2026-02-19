// api/health.js — Vercel serverless health check
module.exports = (req, res) => {
    res.status(200).json({
        status: 'ok',
        mode: 'vercel-static',
        note: 'Multiplayer requires a WebSocket-capable host (Render, Railway, Fly.io)',
        features: {
            offline_play: true,
            multiplayer: false,
            leaderboard: false,
            shop: false,
        },
        timestamp: new Date().toISOString(),
    });
};
