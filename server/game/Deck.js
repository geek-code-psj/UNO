// server/game/Deck.js
const { COLORS, CARD_TYPES } = require('../utils/constants');
const { nextCardId, resetCardIdCounter } = require('../utils/cardUtils');

class Deck {
    constructor() {
        this.cards = [];
        this.discardPile = [];
        resetCardIdCounter();
        this._buildDeck();
        this.shuffle();
    }

    /**
     * Build a standard 108-card UNO deck:
     * - 19 cards per color (one 0, two each of 1-9)
     * - 2 Skip, 2 Reverse, 2 Draw Two per color
     * - 4 Wild, 4 Wild Draw Four
     */
    _buildDeck() {
        for (const color of COLORS) {
            // One zero per color
            this.cards.push({ id: nextCardId(), color, type: CARD_TYPES.NUMBER, value: 0 });

            // Two of each 1-9
            for (let num = 1; num <= 9; num++) {
                this.cards.push({ id: nextCardId(), color, type: CARD_TYPES.NUMBER, value: num });
                this.cards.push({ id: nextCardId(), color, type: CARD_TYPES.NUMBER, value: num });
            }

            // Action cards (2 each per color)
            for (let i = 0; i < 2; i++) {
                this.cards.push({ id: nextCardId(), color, type: CARD_TYPES.SKIP, value: null });
                this.cards.push({ id: nextCardId(), color, type: CARD_TYPES.REVERSE, value: null });
                this.cards.push({ id: nextCardId(), color, type: CARD_TYPES.DRAW_TWO, value: null });
            }
        }

        // Wild cards (4 each)
        for (let i = 0; i < 4; i++) {
            this.cards.push({ id: nextCardId(), color: null, type: CARD_TYPES.WILD, value: null });
            this.cards.push({ id: nextCardId(), color: null, type: CARD_TYPES.WILD_DRAW_FOUR, value: null });
        }
    }

    /** Fisher-Yates shuffle */
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    /** Draw a card from the deck */
    draw() {
        if (this.cards.length === 0) {
            this._recycleDiscardPile();
        }
        return this.cards.pop();
    }

    /** Draw multiple cards */
    drawMultiple(count) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            drawn.push(this.draw());
        }
        return drawn;
    }

    /** Add a card to the discard pile */
    discard(card) {
        this.discardPile.push(card);
    }

    /** Get the top card of the discard pile */
    topCard() {
        return this.discardPile[this.discardPile.length - 1];
    }

    /** Recycle discard pile back into the draw deck */
    _recycleDiscardPile() {
        const topCard = this.discardPile.pop(); // Keep the top card
        this.cards = [...this.discardPile];
        this.discardPile = [topCard];
        this.shuffle();
    }

    /** Get remaining cards count */
    remaining() {
        return this.cards.length;
    }
}

module.exports = Deck;
