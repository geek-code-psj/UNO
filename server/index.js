// server/index.js — Main Server Entry Point
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Initialize database (creates tables if needed)
require('./config/database');

const { verifySocketToken } = require('./middleware/auth');
const GameRoom = require('./game/GameRoom');
const { ROOM_EVENTS, GAME } = require('./utils/constants');

// Express App
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
    pingTimeout: 60000,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── REST API Routes ─────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/tournament', require('./routes/tournament'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// SPA Fallback - Serve index.html for any other requests (Express 5 syntax)
app.get('/{*any}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Game Rooms ──────────────────────────────────────────
const rooms = new Map(); // code -> GameRoom

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function broadcastRoomList() {
    const roomList = Array.from(rooms.values())
        .filter(r => r.state === 'waiting')
        .map(r => r.getInfo());
    io.emit(ROOM_EVENTS.LIST, roomList);
}

// ── Socket.IO Events ────────────────────────────────────
io.on('connection', (socket) => {
    let currentUser = null;
    let currentRoom = null;

    // Authenticate on connect
    const token = socket.handshake.auth.token;
    if (token) {
        currentUser = verifySocketToken(token);
    }

    if (!currentUser) {
        // Allow guest play with temporary ID
        currentUser = {
            id: `guest_${uuidv4().substring(0, 8)}`,
            username: `Guest_${Math.floor(Math.random() * 9999)}`,
            isGuest: true,
        };
    }

    socket.emit('auth:status', { user: currentUser });
    broadcastRoomList();

    // ── Room: Create ────────────────────────────────────
    socket.on(ROOM_EVENTS.CREATE, ({ maxPlayers } = {}) => {
        if (currentRoom) {
            socket.emit(ROOM_EVENTS.ERROR, { error: 'Already in a room' });
            return;
        }

        const code = generateRoomCode();
        const room = new GameRoom(code, currentUser.id, currentUser.username, maxPlayers || 4);

        // Override timeout handler to broadcast via Socket.IO
        room._onTurnTimeout = (player, result) => {
            io.to(code).emit(ROOM_EVENTS.TURN_TIMEOUT, { player, result, state: room.getGameState() });
            sendAllHands(room);
        };

        // Override bot move handler to broadcast bot actions
        room._onBotMove = (bot, move, result) => {
            const gameState = room.getGameState();
            io.to(code).emit('game:state', gameState);
            if (move.action === 'play') {
                io.to(code).emit('game:card_played', {
                    player: bot.username,
                    card: result.card,
                    effect: result.effect,
                });
            }
            sendAllHands(room);
            if (result.gameOver) {
                io.to(code).emit(ROOM_EVENTS.GAME_OVER, {
                    winner: result.winner,
                    scores: result.scores,
                    state: gameState,
                });
                broadcastRoomList();
            }
        };

        // Override bot UNO handler
        room._onBotUno = (bot) => {
            io.to(code).emit('game:uno_called', { player: bot.username });
        };

        // Override bot Challenge Action (Accepting a WD4 or Challenging)
        room._onBotChallengeAction = (bot, action, result) => {
            if (action === 'accept') {
                // Bot accepted the +4
                io.to(code).emit('game:wd4_accepted', {
                    player: bot.username,
                    drawnCount: 4
                });
                io.to(code).emit('game:state', room.getGameState());
            }
        };

        rooms.set(code, room);
        currentRoom = code;
        socket.join(code);
        socket.emit(ROOM_EVENTS.STATE, room.getInfo());
        broadcastRoomList();
    });

    // ── Room: Add Bot ───────────────────────────────────
    socket.on('room:add_bot', ({ difficulty } = {}) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        if (room.players[0].id !== currentUser.id) {
            socket.emit(ROOM_EVENTS.ERROR, { error: 'Only the host can add bots' });
            return;
        }

        const result = room.addBot(difficulty || 'medium');
        if (!result.success) {
            socket.emit(ROOM_EVENTS.ERROR, { error: result.error });
            return;
        }

        io.to(currentRoom).emit(ROOM_EVENTS.PLAYER_UPDATE, room.getInfo());
        broadcastRoomList();
    });

    // ── Room: Remove Bot ────────────────────────────────
    socket.on('room:remove_bot', ({ botId }) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        if (room.players[0].id !== currentUser.id) {
            socket.emit(ROOM_EVENTS.ERROR, { error: 'Only the host can remove bots' });
            return;
        }

        const result = room.removeBot(botId);
        if (!result.success) {
            socket.emit(ROOM_EVENTS.ERROR, { error: result.error });
            return;
        }

        io.to(currentRoom).emit(ROOM_EVENTS.PLAYER_UPDATE, room.getInfo());
        broadcastRoomList();
    });

    // ── Room: Join ──────────────────────────────────────
    socket.on(ROOM_EVENTS.JOIN, ({ code }) => {
        if (currentRoom) {
            socket.emit(ROOM_EVENTS.ERROR, { error: 'Already in a room' });
            return;
        }

        const room = rooms.get(code);
        if (!room) {
            socket.emit(ROOM_EVENTS.ERROR, { error: 'Room not found' });
            return;
        }

        const result = room.addPlayer(currentUser.id, currentUser.username);
        if (!result.success) {
            socket.emit(ROOM_EVENTS.ERROR, { error: result.error });
            return;
        }

        currentRoom = code;
        socket.join(code);

        if (result.reconnected) {
            // Send full game state on reconnect
            socket.emit(ROOM_EVENTS.STATE, room.getInfo());
            if (room.getGameState()) {
                socket.emit('game:state', room.getGameState());
                socket.emit('game:hand', { hand: room.getPlayerHand(currentUser.id) });
            }
        }

        io.to(code).emit(ROOM_EVENTS.PLAYER_UPDATE, room.getInfo());
        broadcastRoomList();
    });

    // ── Room: Leave ─────────────────────────────────────
    socket.on(ROOM_EVENTS.LEAVE, () => {
        handleLeave();
    });

    function handleLeave() {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) { currentRoom = null; return; }

        const result = room.removePlayer(currentUser.id);
        socket.leave(currentRoom);

        if (result.empty) {
            rooms.delete(currentRoom);
        } else {
            io.to(currentRoom).emit(ROOM_EVENTS.PLAYER_UPDATE, room.getInfo());
            if (room.state === 'finished') {
                io.to(currentRoom).emit(ROOM_EVENTS.GAME_OVER, {
                    winner: room.engine?.winner,
                    scores: room.engine?.scores,
                    state: room.getGameState(),
                });
            }
        }

        currentRoom = null;
        broadcastRoomList();
    }

    // ── Game: Start ─────────────────────────────────────
    socket.on(ROOM_EVENTS.START, () => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = room.startGame(currentUser.id);
        if (!result.success) {
            socket.emit(ROOM_EVENTS.ERROR, { error: result.error });
            return;
        }

        // Send game state to everyone
        io.to(currentRoom).emit('game:state', result.state);

        // Send private hands to each human player
        sendAllHands(room);

        broadcastRoomList();
    });

    // ── Game: Play Card ─────────────────────────────────
    socket.on(ROOM_EVENTS.PLAY_CARD, ({ cardId, chosenColor }) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = room.playCard(currentUser.id, cardId, chosenColor);
        if (!result.success) {
            socket.emit(ROOM_EVENTS.ERROR, { error: result.error });
            return;
        }

        // Broadcast updated state
        const gameState = room.getGameState();
        io.to(currentRoom).emit('game:state', gameState);
        io.to(currentRoom).emit('game:card_played', {
            player: currentUser.username,
            card: result.card,
            effect: result.effect,
        });

        // Send updated hands to human players
        sendAllHands(room);

        if (result.gameOver) {
            io.to(currentRoom).emit(ROOM_EVENTS.GAME_OVER, {
                winner: result.winner,
                scores: result.scores,
                state: gameState,
            });
            broadcastRoomList();
        }
    });

    // ── Game: Draw Card ─────────────────────────────────
    socket.on(ROOM_EVENTS.DRAW_CARD, () => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = room.drawCard(currentUser.id);
        if (!result.success) {
            socket.emit(ROOM_EVENTS.ERROR, { error: result.error });
            return;
        }

        // Send the drawn card only to the drawing player
        socket.emit('game:hand', { hand: room.getPlayerHand(currentUser.id) });

        // Broadcast updated state (card counts changed)
        // If this was an acceptance of WD4, emit special event too?
        if (result.action === 'accept_draw_4') {
            io.to(currentRoom).emit('game:wd4_accepted', {
                player: currentUser.username,
                drawnCount: 4
            });
        }

        // Check for win (rare case where drawing caused win? No, usually drawing adds cards)
        // But if engine supports winning on draw (e.g. forced play?), check it.
        if (result.state.gameOver) {
            io.to(currentRoom).emit(ROOM_EVENTS.GAME_OVER, {
                winner: result.state.winner,
                scores: result.state.scores,
                state: result.state,
            });
            broadcastRoomList();
        } else {
            io.to(currentRoom).emit('game:state', room.getGameState());
        }
    });

    // ── Game: Call UNO ──────────────────────────────────
    socket.on(ROOM_EVENTS.CALL_UNO, () => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = room.callUno(currentUser.id);
        if (result.success) {
            io.to(currentRoom).emit('game:uno_called', { player: currentUser.username });
        } else {
            socket.emit(ROOM_EVENTS.ERROR, { error: result.error });
        }
    });

    // ── Game: Challenge UNO ─────────────────────────────
    socket.on(ROOM_EVENTS.CHALLENGE_UNO, ({ targetId }) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = room.challengeUno(currentUser.id, targetId);
        if (result.success) {
            io.to(currentRoom).emit('game:uno_challenged', {
                challenger: currentUser.username,
                target: targetId,
                penaltyCards: result.penaltyCards,
            });
            // Send updated hand to penalized player
            const targetSocket = getPlayerSocket(targetId);
            if (targetSocket) {
                targetSocket.emit('game:hand', { hand: room.getPlayerHand(targetId) });
            }
            io.to(currentRoom).emit('game:state', room.getGameState());
        } else {
            socket.emit(ROOM_EVENTS.ERROR, { error: result.error });
        }
    });

    // ── Game: Challenge Wild Draw 4 ─────────────────────
    socket.on(ROOM_EVENTS.CHALLENGE_WD4, () => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const result = room.challenge(currentUser.id);
        if (result.success) {
            // result.challengeResult contains { winner, penalized, count }
            io.to(currentRoom).emit('game:wd4_challenged', {
                challenger: currentUser.username,
                result: result.challengeResult
            });

            // Send updated hand to penalized player (could be source or challenger)
            const penalizedId = result.challengeResult.penalized;
            const pSocket = getPlayerSocket(penalizedId);
            if (pSocket) {
                pSocket.emit('game:hand', { hand: room.getPlayerHand(penalizedId) });
            }

            // If the challenger lost, they drew cards, so update their hand too (handled above if pSocket matches)

            if (result.state.gameOver) {
                io.to(currentRoom).emit(ROOM_EVENTS.GAME_OVER, {
                    winner: result.state.winner,
                    scores: result.state.scores,
                    state: result.state,
                });
                broadcastRoomList();
            } else {
                io.to(currentRoom).emit('game:state', room.getGameState());
            }
        } else {
            socket.emit(ROOM_EVENTS.ERROR, { error: result.error });
        }
    });

    // ── Chat ────────────────────────────────────────────
    socket.on(ROOM_EVENTS.CHAT_SEND, ({ message }) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const chatMsg = room.addChatMessage(currentUser.id, currentUser.username, message);
        io.to(currentRoom).emit(ROOM_EVENTS.CHAT_MSG, chatMsg);
    });

    socket.on(ROOM_EVENTS.CHAT_EMOJI, ({ emoji }) => {
        if (!currentRoom) return;
        io.to(currentRoom).emit(ROOM_EVENTS.CHAT_EMOJI, {
            player: currentUser.username,
            emoji,
            timestamp: Date.now(),
        });
    });

    // ── Disconnect ──────────────────────────────────────
    socket.on('disconnect', () => {
        handleLeave();
    });

    // ── Helper: Find socket for player ──────────────────
    function getPlayerSocket(playerId) {
        for (const [, s] of io.sockets.sockets) {
            const t = s.handshake.auth.token;
            if (t) {
                const u = verifySocketToken(t);
                if (u && u.id === playerId) return s;
            }
            // Also check guest ID
            if (s._guestId === playerId) return s;
        }
        return null;
    }

    // Store guest ID on socket for lookup
    if (currentUser.isGuest) {
        socket._guestId = currentUser.id;
    }

    // Helper: Send hands to all human players in a room
    function sendAllHands(room) {
        room.players.forEach(p => {
            if (room.bots && room.bots.has(p.id)) return; // Skip bots
            const playerSocket = getPlayerSocket(p.id);
            if (playerSocket) {
                playerSocket.emit('game:hand', { hand: room.getPlayerHand(p.id) });
            }
        });
    }
});

// ── Start Server ────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n  🂡 UNO Multiplayer Server running at http://localhost:${PORT}\n`);
});
