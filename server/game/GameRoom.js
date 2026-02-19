// server/game/GameRoom.js
const GameEngine = require('./GameEngine');
const BotPlayer = require('./BotPlayer');
const { GAME, GAME_STATE, ROOM_EVENTS, REWARDS, BLOCKED_WORDS } = require('../utils/constants');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class GameRoom {
    constructor(code, hostId, hostUsername, maxPlayers = 4) {
        this.code = code;
        this.players = [{ id: hostId, username: hostUsername, connected: true }];
        this.spectators = [];
        this.maxPlayers = Math.min(maxPlayers, GAME.MAX_PLAYERS);
        this.engine = null;
        this.state = GAME_STATE.WAITING;
        this.turnTimerId = null;
        this.botTimerId = null;
        this.createdAt = Date.now();
        this.chatHistory = [];
        this.bots = new Map(); // botId -> BotPlayer
    }

    /** Add a player to the room */
    addPlayer(playerId, username) {
        if (this.state !== GAME_STATE.WAITING) {
            // Check for reconnect
            const existing = this.players.find(p => p.id === playerId);
            if (existing) {
                existing.connected = true;
                return { success: true, reconnected: true };
            }
            return { success: false, error: 'Game already in progress' };
        }

        if (this.players.length >= this.maxPlayers) {
            return { success: false, error: 'Room is full' };
        }

        if (this.players.find(p => p.id === playerId)) {
            return { success: false, error: 'Already in this room' };
        }

        this.players.push({ id: playerId, username, connected: true });
        return { success: true };
    }

    /** Add an AI bot player to the room */
    addBot(difficulty = 'medium') {
        if (this.state !== GAME_STATE.WAITING) {
            return { success: false, error: 'Game already in progress' };
        }
        if (this.players.length >= this.maxPlayers) {
            return { success: false, error: 'Room is full' };
        }

        const bot = new BotPlayer(difficulty);
        this.bots.set(bot.id, bot);
        this.players.push({ id: bot.id, username: bot.username, connected: true, isBot: true });
        return { success: true, bot: { id: bot.id, username: bot.username } };
    }

    /** Remove a bot player */
    removeBot(botId) {
        if (!this.bots.has(botId)) return { success: false, error: 'Bot not found' };
        this.bots.delete(botId);
        this.players = this.players.filter(p => p.id !== botId);
        return { success: true };
    }

    /** Remove a player */
    removePlayer(playerId) {
        if (this.state === GAME_STATE.PLAYING) {
            const player = this.players.find(p => p.id === playerId);
            if (player) player.connected = false;
            // Check if only one connected player remains
            const connected = this.players.filter(p => p.connected);
            if (connected.length <= 1 && this.engine) {
                this._endGame(connected[0]?.id || null);
            }
            return { disconnected: true };
        }

        this.players = this.players.filter(p => p.id !== playerId);
        return { removed: true, empty: this.players.length === 0 };
    }

    /** Start the game */
    startGame(requesterId) {
        if (this.players[0].id !== requesterId) {
            return { success: false, error: 'Only the host can start the game' };
        }
        if (this.players.length < GAME.MIN_PLAYERS) {
            return { success: false, error: `Need at least ${GAME.MIN_PLAYERS} players` };
        }

        this.engine = new GameEngine(this.players.map(p => ({ id: p.id, username: p.username })));
        const state = this.engine.start();
        this.state = GAME_STATE.PLAYING;
        this._startTurnTimer();
        this._scheduleBotTurn();
        return { success: true, state };
    }

    /** Play a card */
    playCard(playerId, cardId, chosenColor) {
        if (!this.engine) return { success: false, error: 'No game in progress' };
        const result = this.engine.playCard(playerId, cardId, chosenColor);

        if (result.success) {
            this._clearTurnTimer();
            if (result.gameOver) {
                this._endGame(result.winner);
            } else {
                this._startTurnTimer();
                this._scheduleBotTurn();
            }
        }
        return result;
    }

    /** Draw a card */
    drawCard(playerId) {
        if (!this.engine) return { success: false, error: 'No game in progress' };
        const result = this.engine.drawCard(playerId);
        if (result.success) {
            this._clearTurnTimer();
            this._startTurnTimer();
            this._scheduleBotTurn();
        }
        return result;
    }

    /** Call UNO */
    callUno(playerId) {
        if (!this.engine) return { success: false, error: 'No game in progress' };
        return this.engine.callUno(playerId);
    }

    /** Challenge UNO */
    challengeUno(challengerId, targetId) {
        if (!this.engine) return { success: false, error: 'No game in progress' };
        return this.engine.challengeUno(challengerId, targetId);
    }

    /** Add a chat message */
    addChatMessage(playerId, username, message) {
        // Basic moderation
        let filtered = message;
        for (const word of BLOCKED_WORDS) {
            const regex = new RegExp(word, 'gi');
            filtered = filtered.replace(regex, '***');
        }

        const chatMsg = {
            id: uuidv4(),
            playerId,
            username,
            message: filtered.substring(0, 200), // Limit length
            timestamp: Date.now(),
        };
        this.chatHistory.push(chatMsg);
        if (this.chatHistory.length > 100) this.chatHistory.shift(); // Keep last 100
        return chatMsg;
    }

    /** Start the turn timer */
    _startTurnTimer() {
        this._clearTurnTimer();
        if (!this.engine || this.engine.state !== GAME_STATE.PLAYING) return;

        const currentPlayer = this.engine.getCurrentPlayer();
        // Don't set timer for bots — they handle themselves via _scheduleBotTurn
        if (this.bots.has(currentPlayer.id)) return;

        this.turnTimerId = setTimeout(() => {
            if (this.engine && this.engine.state === GAME_STATE.PLAYING) {
                const result = this.engine.handleTimeout(currentPlayer.id);
                if (result) {
                    this._onTurnTimeout(currentPlayer, result);
                }
                this._startTurnTimer();
                this._scheduleBotTurn();
            }
        }, GAME.TURN_TIMEOUT_MS);
    }

    _clearTurnTimer() {
        if (this.turnTimerId) {
            clearTimeout(this.turnTimerId);
            this.turnTimerId = null;
        }
        if (this.botTimerId) {
            clearTimeout(this.botTimerId);
            this.botTimerId = null;
        }
    }

    /** Schedule a bot move if it's a bot's turn */
    _scheduleBotTurn() {
        if (!this.engine || this.engine.state !== GAME_STATE.PLAYING) return;
        const currentPlayer = this.engine.getCurrentPlayer();
        const bot = this.bots.get(currentPlayer.id);
        if (!bot) return; // Not a bot's turn

        const thinkTime = bot.getThinkTime();
        this.botTimerId = setTimeout(() => {
            this._executeBotTurn(bot);
        }, thinkTime);
    }

    /** Execute the bot's turn */
    _executeBotTurn(bot) {
        if (!this.engine || this.engine.state !== GAME_STATE.PLAYING) return;
        if (this.engine.getCurrentPlayer().id !== bot.id) return;

        const hand = this.engine.getPlayerHand(bot.id);
        const topCard = this.engine.deck.topCard();
        const gameState = this.engine.getState();
        const move = bot.decideMove(hand, topCard, this.engine.chosenColor, gameState);

        let result;
        if (move.action === 'play') {
            // Call UNO before playing if needed
            if (bot.shouldCallUno(hand.length)) {
                this.callUno(bot.id);
                this._onBotUno(bot);
            }
            result = this.playCard(bot.id, move.cardId, move.chosenColor);
        } else {
            result = this.drawCard(bot.id);
        }

        if (result.success) {
            this._onBotMove(bot, move, result);
        }
    }

    /** Called when a bot plays — override in socket handler */
    _onBotMove(bot, move, result) {
        // Overridden by server/index.js to broadcast via Socket.IO
    }

    /** Called when a bot calls UNO — override in socket handler */
    _onBotUno(bot) {
        // Overridden by server/index.js
    }

    /** Called when turn times out — override in socket handler */
    _onTurnTimeout(player, result) {
        // This is overridden by the socket handler
    }

    /** End the game, persist results, award currency */
    _endGame(winnerId) {
        this._clearTurnTimer();
        this.state = GAME_STATE.FINISHED;

        if (!winnerId) return;

        // Persist game history
        try {
            const gameId = uuidv4();
            const playerIds = this.players.map(p => p.id);
            db.prepare(`
        INSERT INTO game_history (id, room_code, players, winner_id, duration_seconds)
        VALUES (?, ?, ?, ?, ?)
      `).run(
                gameId,
                this.code,
                JSON.stringify(playerIds),
                winnerId,
                Math.round((Date.now() - this.createdAt) / 1000)
            );

            // Update player stats and award coins (skip bots)
            for (const player of this.players) {
                if (this.bots.has(player.id)) continue; // Skip bots
                const isWinner = player.id === winnerId;
                const reward = isWinner ? REWARDS.WIN_GAME : REWARDS.LOSE_GAME;

                db.prepare(`
          UPDATE users SET
            wins = wins + ?,
            losses = losses + ?,
            games_played = games_played + 1,
            coins = coins + ?
          WHERE id = ?
        `).run(isWinner ? 1 : 0, isWinner ? 0 : 1, reward, player.id);

                // Log transaction
                db.prepare(`
          INSERT INTO transactions (id, user_id, amount, type, reason)
          VALUES (?, ?, ?, 'earn', ?)
        `).run(uuidv4(), player.id, reward, isWinner ? 'Game win reward' : 'Game participation reward');
            }
        } catch (err) {
            console.error('Error persisting game results:', err);
        }
    }

    /** Get room info for lobby */
    getInfo() {
        return {
            code: this.code,
            players: this.players.map(p => ({ id: p.id, username: p.username, connected: p.connected, isBot: !!p.isBot })),
            maxPlayers: this.maxPlayers,
            state: this.state,
            playerCount: this.players.length,
        };
    }

    /** Get full game state */
    getGameState() {
        if (!this.engine) return null;
        return this.engine.getState();
    }

    /** Get player's hand */
    getPlayerHand(playerId) {
        if (!this.engine) return [];
        return this.engine.getPlayerHand(playerId);
    }
}

module.exports = GameRoom;
