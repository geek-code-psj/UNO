// server/game/GameEngine.js
const Deck = require('./Deck');
const { GAME, CARD_TYPES, GAME_STATE } = require('../utils/constants');
const { canPlayCard, calculateHandScore } = require('../utils/cardUtils');

class GameEngine {
    constructor(players) {
        this.players = players; // [{ id, username }]
        this.hands = {};        // { playerId: [cards] }
        this.deck = new Deck();
        this.state = GAME_STATE.WAITING;
        this.currentPlayerIndex = 0;
        this.direction = 1;     // 1 = clockwise, -1 = counter-clockwise
        this.chosenColor = null; // Color chosen after a wild card
        this.turnTimer = null;
        this.unoCalledBy = new Set();
        this.drawStack = 0;     // Stacked draw-two / draw-four count
        this.winner = null;
        this.scores = {};
        this.turnStartTime = null;
        this.skipNextPlayer = false;
    }

    /** Start the game: deal cards, flip first card */
    start() {
        if (this.players.length < GAME.MIN_PLAYERS) {
            throw new Error(`Need at least ${GAME.MIN_PLAYERS} players`);
        }
        this.state = GAME_STATE.PLAYING;

        // Deal 7 cards to each player
        for (const player of this.players) {
            this.hands[player.id] = this.deck.drawMultiple(GAME.INITIAL_HAND_SIZE);
        }

        // Flip the first card onto discard pile (must be a number card)
        let firstCard = this.deck.draw();
        while (firstCard.type !== CARD_TYPES.NUMBER) {
            this.deck.cards.unshift(firstCard);
            this.deck.shuffle();
            firstCard = this.deck.draw();
        }
        this.deck.discard(firstCard);

        this.currentPlayerIndex = 0;
        this.turnStartTime = Date.now();
        return this.getState();
    }

    /** Get the current player */
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    /** Advance turn to the next player */
    _nextTurn() {
        this.unoCalledBy.clear();
        this.chosenColor = null;
        this.currentPlayerIndex = this._getNextPlayerIndex();
        this.turnStartTime = Date.now();
    }

    _getNextPlayerIndex() {
        let next = this.currentPlayerIndex + this.direction;
        if (next >= this.players.length) next = 0;
        if (next < 0) next = this.players.length - 1;
        return next;
    }

    /** Play a card from the current player's hand */
    playCard(playerId, cardId, chosenColor = null) {
        if (this.state !== GAME_STATE.PLAYING) {
            return { success: false, error: 'Game is not in progress' };
        }
        if (this.getCurrentPlayer().id !== playerId) {
            return { success: false, error: 'Not your turn' };
        }

        const hand = this.hands[playerId];
        const cardIndex = hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) {
            return { success: false, error: 'Card not in your hand' };
        }

        const card = hand[cardIndex];
        const topCard = this.deck.topCard();

        if (!canPlayCard(card, topCard, this.chosenColor)) {
            return { success: false, error: 'Invalid card play' };
        }

        // Wild draw four: validate (optional challenge mechanic)
        if (card.type === CARD_TYPES.WILD_DRAW_FOUR && !chosenColor) {
            return { success: false, error: 'Must choose a color with Wild Draw Four' };
        }

        if ((card.type === CARD_TYPES.WILD) && !chosenColor) {
            return { success: false, error: 'Must choose a color with Wild card' };
        }

        // Remove card from hand
        hand.splice(cardIndex, 1);
        this.deck.discard(card);

        // Set chosen color for wilds
        if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
            this.chosenColor = chosenColor;
        } else {
            this.chosenColor = null;
        }

        // Check for win
        if (hand.length === 0) {
            return this._handleWin(playerId);
        }

        // Apply card effects
        const effect = this._applyCardEffect(card);

        return { success: true, card, effect, state: this.getState() };
    }

    /** Apply special card effects */
    _applyCardEffect(card) {
        let effect = { type: card.type };

        switch (card.type) {
            case CARD_TYPES.SKIP: {
                // Skip next player
                this._nextTurn(); // Move to next (who gets skipped)
                effect.skippedPlayer = this.getCurrentPlayer();
                this._nextTurn(); // Move to the one after
                break;
            }
            case CARD_TYPES.REVERSE: {
                if (this.players.length === 2) {
                    // In 2-player, reverse acts like skip
                    this._nextTurn();
                    effect.skippedPlayer = this.getCurrentPlayer();
                    this._nextTurn();
                } else {
                    this.direction *= -1;
                    this._nextTurn();
                }
                effect.direction = this.direction;
                break;
            }
            case CARD_TYPES.DRAW_TWO: {
                this._nextTurn();
                const target = this.getCurrentPlayer();
                const drawn = this.deck.drawMultiple(2);
                this.hands[target.id].push(...drawn);
                effect.target = target;
                effect.cardsDrawn = 2;
                // Skip the target player's turn
                this._nextTurn();
                break;
            }
            case CARD_TYPES.WILD_DRAW_FOUR: {
                this._nextTurn();
                const target4 = this.getCurrentPlayer();
                const drawn4 = this.deck.drawMultiple(4);
                this.hands[target4.id].push(...drawn4);
                effect.target = target4;
                effect.cardsDrawn = 4;
                // Skip the target player's turn
                this._nextTurn();
                break;
            }
            default:
                // Number or Wild (no special effect beyond color)
                this._nextTurn();
                break;
        }

        return effect;
    }

    /** Draw a card from the deck */
    drawCard(playerId) {
        if (this.state !== GAME_STATE.PLAYING) {
            return { success: false, error: 'Game is not in progress' };
        }
        if (this.getCurrentPlayer().id !== playerId) {
            return { success: false, error: 'Not your turn' };
        }

        const card = this.deck.draw();
        this.hands[playerId].push(card);

        // Check if drawn card can be played (auto-advance if not)
        const topCard = this.deck.topCard();
        const canPlay = canPlayCard(card, topCard, this.chosenColor);

        // Advance turn regardless (player can play on their next draw if they want)
        this._nextTurn();

        return { success: true, card, canPlay, state: this.getState() };
    }

    /** Call UNO when player has 1 card */
    callUno(playerId) {
        if (this.hands[playerId] && this.hands[playerId].length <= 2) {
            this.unoCalledBy.add(playerId);
            return { success: true };
        }
        return { success: false, error: 'You can only call UNO with 1-2 cards' };
    }

    /** Challenge a player who didn't call UNO */
    challengeUno(challengerId, targetId) {
        if (!this.hands[targetId] || this.hands[targetId].length !== 1) {
            return { success: false, error: 'Target does not have exactly 1 card' };
        }
        if (this.unoCalledBy.has(targetId)) {
            return { success: false, error: 'Player already called UNO' };
        }

        // Penalty: target draws 2 cards
        const penalty = this.deck.drawMultiple(2);
        this.hands[targetId].push(...penalty);
        return { success: true, penaltyCards: 2, target: targetId };
    }

    /** Handle turn timeout - auto draw */
    handleTimeout(playerId) {
        if (this.getCurrentPlayer().id !== playerId) return null;
        return this.drawCard(playerId);
    }

    /** Handle win condition */
    _handleWin(winnerId) {
        this.state = GAME_STATE.FINISHED;
        this.winner = winnerId;

        // Calculate scores from remaining hands
        this.scores = {};
        let totalScore = 0;
        for (const player of this.players) {
            if (player.id !== winnerId) {
                const score = calculateHandScore(this.hands[player.id]);
                this.scores[player.id] = score;
                totalScore += score;
            }
        }
        this.scores[winnerId] = totalScore; // Winner gets sum of all other hands

        return {
            success: true,
            gameOver: true,
            winner: winnerId,
            scores: this.scores,
            state: this.getState(),
        };
    }

    /** Get sanitized game state (for broadcasting) */
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
                cardCount: this.hands[p.id] ? this.hands[p.id].length : 0,
            })),
            players: this.players,
            winner: this.winner,
            scores: this.scores,
        };
    }

    /** Get a specific player's hand (private info) */
    getPlayerHand(playerId) {
        return this.hands[playerId] || [];
    }
}

module.exports = GameEngine;
