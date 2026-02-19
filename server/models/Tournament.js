// server/models/Tournament.js
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { REWARDS } = require('../utils/constants');

const Tournament = {
    create(name, maxPlayers, entryFee, createdBy, startsAt) {
        // Ensure max players is a power of 2
        const validSizes = [4, 8, 16, 32];
        if (!validSizes.includes(maxPlayers)) {
            maxPlayers = validSizes.reduce((prev, curr) =>
                Math.abs(curr - maxPlayers) < Math.abs(prev - maxPlayers) ? curr : prev
            );
        }

        const id = uuidv4();
        db.prepare(`
      INSERT INTO tournaments (id, name, max_players, entry_fee, prize_pool, created_by, starts_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, maxPlayers, entryFee, 0, createdBy, startsAt || null);
        return { id, name, maxPlayers, entryFee };
    },

    findById(id) {
        return db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id);
    },

    list(status = null) {
        if (status) {
            return db.prepare('SELECT * FROM tournaments WHERE status = ? ORDER BY created_at DESC').all(status);
        }
        return db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC LIMIT 50').all();
    },

    join(tournamentId, userId) {
        const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
        if (!tournament) return { success: false, error: 'Tournament not found' };
        if (tournament.status !== 'registration') return { success: false, error: 'Registration closed' };

        const playerCount = db.prepare('SELECT COUNT(*) as c FROM tournament_players WHERE tournament_id = ?').get(tournamentId).c;
        if (playerCount >= tournament.max_players) return { success: false, error: 'Tournament is full' };

        const existing = db.prepare('SELECT * FROM tournament_players WHERE tournament_id = ? AND user_id = ?').get(tournamentId, userId);
        if (existing) return { success: false, error: 'Already registered' };

        // Deduct entry fee
        if (tournament.entry_fee > 0) {
            const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
            if (!user || user.coins < tournament.entry_fee) return { success: false, error: 'Not enough coins' };
            db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(tournament.entry_fee, userId);
            db.prepare('UPDATE tournaments SET prize_pool = prize_pool + ? WHERE id = ?').run(tournament.entry_fee, tournamentId);
            db.prepare(`INSERT INTO transactions (id, user_id, amount, type, reason) VALUES (?, ?, ?, 'spend', ?)`).run(uuidv4(), userId, tournament.entry_fee, `Tournament entry: ${tournament.name}`);
        }

        db.prepare('INSERT INTO tournament_players (tournament_id, user_id, seed) VALUES (?, ?, ?)').run(tournamentId, userId, playerCount + 1);
        return { success: true };
    },

    getPlayers(tournamentId) {
        return db.prepare(`
      SELECT tp.*, u.username FROM tournament_players tp
      JOIN users u ON tp.user_id = u.id
      WHERE tp.tournament_id = ?
      ORDER BY tp.seed
    `).all(tournamentId);
    },

    generateBracket(tournamentId) {
        const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
        if (!tournament) return { success: false, error: 'Tournament not found' };

        const players = this.getPlayers(tournamentId);
        if (players.length < 2) return { success: false, error: 'Not enough players' };

        // Build single-elimination bracket
        const rounds = Math.ceil(Math.log2(players.length));
        const bracket = [];

        // First round: pair players
        const firstRound = [];
        for (let i = 0; i < players.length; i += 2) {
            firstRound.push({
                matchId: uuidv4(),
                round: 1,
                player1: { id: players[i].user_id, username: players[i].username },
                player2: players[i + 1] ? { id: players[i + 1].user_id, username: players[i + 1].username } : null,
                winner: players[i + 1] ? null : players[i].user_id, // Bye if odd
                roomCode: null,
                status: players[i + 1] ? 'pending' : 'bye',
            });
        }
        bracket.push(firstRound);

        // Subsequent rounds (empty slots)
        let matchCount = Math.ceil(firstRound.length / 2);
        for (let round = 2; round <= rounds; round++) {
            const roundMatches = [];
            for (let i = 0; i < matchCount; i++) {
                roundMatches.push({
                    matchId: uuidv4(),
                    round,
                    player1: null,
                    player2: null,
                    winner: null,
                    roomCode: null,
                    status: 'pending',
                });
            }
            bracket.push(roundMatches);
            matchCount = Math.ceil(matchCount / 2);
        }

        db.prepare('UPDATE tournaments SET bracket = ?, status = ? WHERE id = ?').run(JSON.stringify(bracket), 'active', tournamentId);
        return { success: true, bracket };
    },

    recordMatchResult(tournamentId, matchId, winnerId) {
        const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
        if (!tournament) return { success: false, error: 'Tournament not found' };

        const bracket = JSON.parse(tournament.bracket);

        // Find the match
        let matchRound = -1, matchIndex = -1;
        for (let r = 0; r < bracket.length; r++) {
            for (let m = 0; m < bracket[r].length; m++) {
                if (bracket[r][m].matchId === matchId) {
                    matchRound = r;
                    matchIndex = m;
                    break;
                }
            }
            if (matchRound >= 0) break;
        }

        if (matchRound < 0) return { success: false, error: 'Match not found' };

        // Set winner
        bracket[matchRound][matchIndex].winner = winnerId;
        bracket[matchRound][matchIndex].status = 'completed';

        // Advance to next round
        const nextRound = matchRound + 1;
        if (nextRound < bracket.length) {
            const nextMatchIndex = Math.floor(matchIndex / 2);
            const slot = matchIndex % 2 === 0 ? 'player1' : 'player2';
            const winnerName = bracket[matchRound][matchIndex].player1?.id === winnerId
                ? bracket[matchRound][matchIndex].player1.username
                : bracket[matchRound][matchIndex].player2?.username;

            bracket[nextRound][nextMatchIndex][slot] = { id: winnerId, username: winnerName };
        } else {
            // Tournament is over — this was the final
            this._completeTournament(tournamentId, winnerId, tournament.prize_pool);
        }

        db.prepare('UPDATE tournaments SET bracket = ? WHERE id = ?').run(JSON.stringify(bracket), tournamentId);
        return { success: true, bracket };
    },

    _completeTournament(tournamentId, winnerId, prizePool) {
        db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('completed', tournamentId);

        // Award prizes
        const winnerPrize = Math.max(prizePool, REWARDS.WIN_TOURNAMENT);
        db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(winnerPrize, winnerId);
        db.prepare(`INSERT INTO transactions (id, user_id, amount, type, reason) VALUES (?, ?, ?, 'earn', 'Tournament victory')`).run(uuidv4(), winnerId, winnerPrize);
    },
};

module.exports = Tournament;
