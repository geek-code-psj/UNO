const Deck = require('./Deck');
const { GAME, CARD_TYPES, GAME_STATE, CARD_VALUES } = require('../utils/constants');
const { canPlayCard } = require('../utils/cardUtils');

class GameEngine {
    constructor(players) {
        this.players = players; // [{ id, username }]
        this.hands = {};        // { playerId: [cards] }
        this.deck = new Deck();
        this.state = GAME_STATE.WAITING;
        this.currentPlayerIndex = 0;
        this.direction = 1;     // 1 = clockwise, -1 = counter-clockwise
        this.chosenColor = null; // Color chosen after a wild card

        // Challenge State
        this.pendingAction = null; // { type: 'wild_draw_four', sourcePlayerId, targetPlayerId, card, prevColor }

        this.unoCalledBy = new Set(); // Set of playerIds who called UNO
        this.winner = null;
        this.scores = {};
        this.turnStartTime = null;
    }

    /** Start the game */
    start() {
        if (this.players.length < GAME.MIN_PLAYERS) {
            throw new Error(`Need at least ${GAME.MIN_PLAYERS} players`);
        }
        this.state = GAME_STATE.PLAYING;
        this.deck = new Deck(); // Fresh deck
        this.hands = {};
        this.unoCalledBy = new Set();
        this.pendingAction = null;
        this.direction = 1;
        this.chosenColor = null;

        // Deal 7 cards to each player
        for (const player of this.players) {
            this.hands[player.id] = this.deck.drawMultiple(GAME.INITIAL_HAND_SIZE);
        }

        // Flip first card
        let firstCard = this.deck.draw();
        while (firstCard.type === CARD_TYPES.WILD_DRAW_FOUR) {
            this.deck.cards.unshift(firstCard);
            this.deck.shuffle();
            firstCard = this.deck.draw();
        }
        this.deck.discard(firstCard);

        // Handle first card effects
        if (firstCard.type === CARD_TYPES.WILD) {
            // Official rule: first player chooses color. For simplicity, we can default or prompt. 
            // Better: random color for start or "Waiting for color" state? 
            // Let's just pick random valid Color to start if it's Wild to keep it simple
            this.chosenColor = ['red', 'blue', 'green', 'yellow'][Math.floor(Math.random() * 4)];
        } else if (firstCard.type === CARD_TYPES.REVERSE) {
            this.direction = -1;
            this.currentPlayerIndex = this.players.length - 1; // Dealer (last) goes first? No, first player is left of dealer.
            // Simplified: Start at 0 usually. If Reverse, direction flips.
            // If strict: Dealer is last. First player is 0.
            // If Reverse flipped at start: Dealer goes first.
            this.currentPlayerIndex = this.players.length - 1;
        } else if (firstCard.type === CARD_TYPES.SKIP) {
            this.currentPlayerIndex = 1; // Skip player 0
        } else if (firstCard.type === CARD_TYPES.DRAW_TWO) {
            // Player 0 draws 2 and is skipped
            const p0 = this.players[0];
            this.hands[p0.id].push(...this.deck.drawMultiple(2));
            this.currentPlayerIndex = 1;
        } else {
            this.currentPlayerIndex = 0;
        }

        // Ensure index is valid
        if (this.currentPlayerIndex < 0) this.currentPlayerIndex = this.players.length - 1;
        if (this.currentPlayerIndex >= this.players.length) this.currentPlayerIndex = 0;

        this.turnStartTime = Date.now();
        return this.getState();
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    _getNextPlayerIndex(offset = 1) {
        let index = this.currentPlayerIndex + (this.direction * offset);
        // Wrap around
        while (index < 0) index += this.players.length;
        while (index >= this.players.length) index -= this.players.length;
        return index;
    }

    _nextTurn(skip = false) {
        if (this.pendingAction) return; // Cannot advance if pending action

        this.currentPlayerIndex = this._getNextPlayerIndex(skip ? 2 : 1);
        this.turnStartTime = Date.now();

        // Reset per-turn flags
        // UNO call persists until they play their 2nd to last card? 
        // Logic: UNO must be called BEFORE playing the card that leaves you with 1.
        // Or strictly: When you play your second to last card.
        // We clear 'called' flags for the *incoming* player usually? 
        // Actually, unoCalledBy should track who has "Safe" status. 
        // If a player has > 1 card, remove them from safe list.
        for (const pid of this.unoCalledBy) {
            if (this.hands[pid] && this.hands[pid].length > 1) {
                this.unoCalledBy.delete(pid);
            }
        }
    }

    playCard(playerId, cardId, chosenColor = null) {
        if (this.state !== GAME_STATE.PLAYING) return { success: false, error: 'Game not active' };
        if (this.pendingAction) return { success: false, error: 'Waiting for challenge response' };

        const player = this.getCurrentPlayer();
        if (player.id !== playerId) return { success: false, error: 'Not your turn' };

        const hand = this.hands[playerId];
        const cardIndex = hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return { success: false, error: 'Card not in hand' };

        const card = hand[cardIndex];
        const topCard = this.deck.topCard();

        // Check legality
        const activeColor = this.chosenColor || topCard.color;
        // WD4 Check: strictly speaking, can only be played if you have NO card of activeColor.
        // But the ENGINE allows playing it (bluffing). Logic handles challenge later.

        // Basic match check (Wilds always match)
        if (!canPlayCard(card, topCard, this.chosenColor)) {
            return { success: false, error: 'Illegal move' };
        }

        if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
            if (!chosenColor) return { success: false, error: 'Must choose color' };
        }

        // Before playing, check UNO failure
        // If player has 2 cards and plays 1 -> has 1 left. Must have called UNO.
        // Strict: "You must say UNO before playing your next-to-last card."
        // We'll allow calling it *during* the turn before play.
        if (hand.length === 2 && !this.unoCalledBy.has(playerId)) {
            // Any other player can challenge strictly, but usually we auto-penalize or 
            // wait for challenge?
            // "If you are caught not saying UNO before your next player begins their turn..."
            // For this engine, we'll let it slide until someone challenges `challengeUno`.
        }

        // Remove card
        hand.splice(cardIndex, 1);
        this.deck.discard(card);

        // If hand empty (and no effect that stops win?), WIN!
        // But Action cards might require resolution? 
        // Official: If last card is Draw 2 or WD4, next player MUST draw. This counts for scoring.

        this.chosenColor = (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR)
            ? chosenColor : null;

        let effect = { type: card.type };
        let gameOver = false;

        // Apply Effects
        if (card.type === CARD_TYPES.WILD_DRAW_FOUR) {
            // State becomes PENDING_ACTION
            const nextPIndex = this._getNextPlayerIndex(1);
            const targetPlayer = this.players[nextPIndex];

            // Store info for challenge
            // We need to know if the player HAD the match color (prev activeColor)
            // The activeColor was `activeColor` variable before we discarded the new card.
            const hasMatch = hand.some(c => c.color === activeColor); // `hand` is already spliced, but we check what REMAINED? No, what they HAD.
            // Wait, we removed the card. So we check the hand *before* removal?
            // Yes. We need to check if they *had* the color.
            // Since we already removed the WD4, the rest of the hand is what matters? 
            // "If you have a matching color card in your hand". 
            // Yes, checking the remaining hand for the `activeColor`.

            this.pendingAction = {
                type: 'wild_draw_four',
                sourcePlayerId: playerId,
                targetPlayerId: targetPlayer.id,
                prevColor: activeColor, // The color they needed to match
                bluffing: hasMatch // If true, they are guilty
            };

            // IMPORTANT: If they won (0 cards), the game ends AFTER the challenge resolution?
            // Official: "If you play a WD4 as your last card, the next player must assume the risk to challenge or draw."
            // We don't change currentPlayerIndex yet.

        } else if (card.type === CARD_TYPES.DRAW_TWO) {
            const nextPIndex = this._getNextPlayerIndex(1);
            const targetPlayer = this.players[nextPIndex];
            const drawn = this.deck.drawMultiple(2);
            this.hands[targetPlayer.id].push(...drawn);
            effect.target = targetPlayer.id;
            effect.cardsDrawn = 2;
            this._nextTurn(true); // Skip target

        } else if (card.type === CARD_TYPES.SKIP) {
            this._nextTurn(true); // Skip

        } else if (card.type === CARD_TYPES.REVERSE) {
            if (this.players.length === 2) {
                this._nextTurn(true); // Act as Skip
            } else {
                this.direction *= -1;
                this._nextTurn();
            }
            effect.direction = this.direction;

        } else {
            // Number or Wild
            this._nextTurn();
        }

        // Check Win Condition (Immediate unless Pending Action)
        if (hand.length === 0 && !this.pendingAction) {
            return this._handleWin(playerId);
        }

        return { success: true, card, effect, state: this.getState() };
    }

    drawCard(playerId) {
        if (this.state !== GAME_STATE.PLAYING) return { success: false, error: 'Not playing' };

        // Handle Pending Action Responses
        if (this.pendingAction) {
            if (this.pendingAction.targetPlayerId !== playerId) {
                return { success: false, error: 'Waiting for target player' };
            }
            // If drawing, they accept the +4
            if (this.pendingAction.type === 'wild_draw_four') {
                const drawn = this.deck.drawMultiple(4);
                this.hands[playerId].push(...drawn);
                this.pendingAction = null;

                // If the player who played it has 0 cards, they win NOW
                if (this.hands[this.players[this.currentPlayerIndex].id].length === 0) {
                    return this._handleWin(this.players[this.currentPlayerIndex].id);
                }

                this._nextTurn(true); // Skip the drawer
                return { success: true, action: 'accept_draw_4', drawnCount: 4, state: this.getState() };
            }
        }

        // Normal Draw
        if (this.getCurrentPlayer().id !== playerId) return { success: false, error: 'Not your turn' };

        const card = this.deck.draw();
        this.hands[playerId].push(card);
        this.unoCalledBy.delete(playerId); // If you draw, you are safe/reset? Actually if you have 1 card now?
        // Logic: if you draw and now have 2, you are fine. If you draw and have 1?

        // Check if playable immediately
        const topCard = this.deck.topCard();
        const canPlay = canPlayCard(card, topCard, this.chosenColor);

        // Auto-pass if not playable? Or explicitly allow "Play or Pass"?
        // Simplified: Auto-pass if not playable. If playable, user can call playCard immediately.
        // We'll return canPlay. Frontend decides.
        // Actually, to keep turn logic simple: standard UNO often forces end of turn if you don't play the drawn card.
        // But if you CAN play it, you MAY.
        // We won't auto-advance turn here. The USER must either Play the new card OR "Pass".
        // But to avoid complex "Pass" button, we often just auto-pass if unplayable.

        if (!canPlay) {
            this._nextTurn();
        }

        return { success: true, card, canPlay, state: this.getState() };
    }

    passTurn(playerId) {
        if (this.getCurrentPlayer().id !== playerId) return { success: false };
        this._nextTurn();
        return { success: true, state: this.getState() };
    }

    challenge(playerId) {
        if (!this.pendingAction || this.pendingAction.targetPlayerId !== playerId) {
            return { success: false, error: 'Cannot challenge now' };
        }

        if (this.pendingAction.type === 'wild_draw_four') {
            const sourceId = this.pendingAction.sourcePlayerId;
            const guilty = this.pendingAction.bluffing;

            let result = {};

            if (guilty) {
                // Sender draws 4
                const drawn = this.deck.drawMultiple(4);
                this.hands[sourceId].push(...drawn);
                result = { winner: 'challenger', penalized: sourceId, count: 4 };
                // Turn logic:
                // Original card stays played? Yes.
                // Challenger (target) does NOT draw 4.
                // Does Challenger play now? 
                // "If the challenged player is guilty, they must draw the 4 cards and the turn passes to the next player."
                // Wait. Next from whom? The challenger? Or the next AFTER challenger?
                // Usually play continues. Since challenger didn't lose turn, they play?
                // Actually: "The cards are returned to the offender's hand"? No, "draw 4".
                // Let's stick to: Source draws 4. Target plays.
                this.pendingAction = null;
                // Don't skip target. Target is current "Next", so we just advance from Source to Target?
                // We are currently at Source index.
                this._nextTurn(false); // Move to target
            } else {
                // Innocent: Challenger draws 6 (4+2) and loses turn
                const drawn = this.deck.drawMultiple(6);
                this.hands[playerId].push(...drawn);
                result = { winner: 'source', penalized: playerId, count: 6 };
                this.pendingAction = null;

                // If Source had 0 cards, they win NOW
                const sourceHand = this.hands[sourceId];
                if (sourceHand && sourceHand.length === 0) {
                    return this._handleWin(sourceId);
                }

                this._nextTurn(true); // Skip target
            }

            return { success: true, challengeResult: result, state: this.getState() };
        }
    }

    callUno(playerId) {
        const hand = this.hands[playerId];
        if (!hand) return { success: false };

        if (hand.length <= 2) {
            this.unoCalledBy.add(playerId);
            return { success: true };
        }
        return { success: false, error: 'Too many cards' };
    }

    challengeUno(playerId, targetId) {
        const hand = this.hands[targetId];
        if (!hand || hand.length !== 1) return { success: false, error: 'Target has > 1 card' };

        if (this.unoCalledBy.has(targetId)) return { success: false, error: 'Already called UNO' };

        // Draw 2 penalty
        const drawn = this.deck.drawMultiple(2);
        this.hands[targetId].push(...drawn);
        this.unoCalledBy.add(targetId); // Mark safe to prevent spam

        return { success: true, target: targetId, count: 2, state: this.getState() };
    }

    _handleWin(winnerId) {
        this.state = GAME_STATE.FINISHED;
        this.winner = winnerId;

        // Calculate scores
        this.scores = {};
        let winnerScore = 0;

        for (const p of this.players) {
            const hand = this.hands[p.id];
            if (p.id === winnerId) {
                this.scores[p.id] = 0; // Temp
                continue;
            }

            let pts = 0;
            for (const c of hand) {
                if (c.type === CARD_TYPES.NUMBER) pts += c.value;
                else if (c.type === CARD_TYPES.WILD_DRAW_FOUR || c.type === CARD_TYPES.WILD) pts += 50;
                else pts += 20;
            }
            this.scores[p.id] = pts;
            winnerScore += pts;
        }
        this.scores[winnerId] = winnerScore;

        return { success: true, gameOver: true, winner: winnerId, scores: this.scores, state: this.getState() };
    }

    getState() {
        return {
            state: this.state,
            currentPlayer: this.getCurrentPlayer(),
            direction: this.direction,
            topCard: this.deck.topCard(),
            chosenColor: this.chosenColor,
            deckRemaining: this.deck.remaining(),
            playerCardCounts: this.players.map(p => ({
                id: p.id,
                username: p.username,
                isBot: false, // Updated by room
                cardCount: this.hands[p.id] ? this.hands[p.id].length : 0
            })),
            pendingAction: this.pendingAction ? {
                type: this.pendingAction.type,
                targetPlayerId: this.pendingAction.targetPlayerId
            } : null,
            players: this.players,
            winner: this.winner,
            scores: this.scores
        };
    }

    getPlayerHand(playerId) {
        return this.hands[playerId] || [];
    }

    // Auto-draw on timeout
    handleTimeout(playerId) {
        if (this.pendingAction && this.pendingAction.targetPlayerId === playerId) {
            // Timeout on challenge = Accept draw
            return this.drawCard(playerId);
        }
        return this.drawCard(playerId);
    }
}

module.exports = GameEngine;
