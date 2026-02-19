// server/game/BotPlayer.js — AI bot that plays UNO
const { canPlayCard } = require('../utils/cardUtils');
const { COLORS, CARD_TYPES } = require('../utils/constants');

const BOT_NAMES = [
    '🤖 RoboUno', '🤖 CardMaster', '🤖 BotBoss', '🤖 MegaBot',
    '🤖 UnoBot', '🤖 AIPlayer', '🤖 DeepPlay', '🤖 SmartDeck',
];

const DIFFICULTY = {
    easy: { thinkTimeMs: 2000, smartPlayChance: 0.3 },
    medium: { thinkTimeMs: 1500, smartPlayChance: 0.65 },
    hard: { thinkTimeMs: 1000, smartPlayChance: 0.9 },
};

class BotPlayer {
    constructor(difficulty = 'medium') {
        this.id = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.username = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
        this.isBot = true;
        this.difficulty = DIFFICULTY[difficulty] || DIFFICULTY.medium;
        this.difficultyName = difficulty;
    }

    /**
     * Decide which card to play, given the bot's hand and the current game state.
     * Returns { action: 'play', cardId, chosenColor } or { action: 'draw' }
     */
    decideMove(hand, topCard, chosenColor, gameState) {
        const playable = hand.filter(c => canPlayCard(c, topCard, chosenColor));

        if (playable.length === 0) {
            return { action: 'draw' };
        }

        // Should the bot play smart or random?
        const playsSmart = Math.random() < this.difficulty.smartPlayChance;

        let chosen;
        if (playsSmart) {
            chosen = this._smartPick(playable, hand, gameState);
        } else {
            chosen = playable[Math.floor(Math.random() * playable.length)];
        }

        // If wild, choose a color
        let colorChoice = null;
        if (chosen.type === CARD_TYPES.WILD || chosen.type === CARD_TYPES.WILD_DRAW_FOUR) {
            colorChoice = this._pickBestColor(hand, chosen);
        }

        return { action: 'play', cardId: chosen.id, chosenColor: colorChoice };
    }

    /**
     * Smart card selection strategy:
     * 1. Prefer action cards (draw-two, skip, reverse) to hurt opponents
     * 2. Prefer playing cards of the color with the most cards in hand
     * 3. Save wild cards for later unless low on cards
     * 4. If opponent has 1-2 cards, play draw-two / wild-draw-four
     */
    _smartPick(playable, hand, gameState) {
        // Check if any opponent is close to winning
        const opponentClose = gameState?.playerCardCounts?.some(
            p => p.id !== this.id && p.cardCount <= 2
        );

        // Separate by type
        const drawCards = playable.filter(c =>
            c.type === CARD_TYPES.DRAW_TWO || c.type === CARD_TYPES.WILD_DRAW_FOUR
        );
        const actionCards = playable.filter(c =>
            c.type === CARD_TYPES.SKIP || c.type === CARD_TYPES.REVERSE
        );
        const numberCards = playable.filter(c => c.type === CARD_TYPES.NUMBER);
        const wildCards = playable.filter(c =>
            c.type === CARD_TYPES.WILD && c.type !== CARD_TYPES.WILD_DRAW_FOUR
        );

        // If opponent is close, play draw cards if available
        if (opponentClose && drawCards.length > 0) {
            return drawCards[0];
        }

        // If we have few cards, try action cards to maintain advantage
        if (hand.length <= 3 && actionCards.length > 0) {
            return actionCards[0];
        }

        // Count colors in hand to play the dominant color
        const colorCounts = {};
        for (const c of hand) {
            if (c.color) colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
        }

        // Prefer number cards of the dominant color
        const dominantColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const dominantNumberCards = numberCards.filter(c => c.color === dominantColor);
        if (dominantNumberCards.length > 0) {
            // Play highest number to maximize opponent's potential score
            return dominantNumberCards.sort((a, b) => b.value - a.value)[0];
        }

        // Play any number card
        if (numberCards.length > 0) {
            return numberCards.sort((a, b) => b.value - a.value)[0];
        }

        // Play action cards
        if (actionCards.length > 0) return actionCards[0];
        if (drawCards.length > 0) return drawCards[0];

        // Last resort: wilds (save them if possible, but play if only option)
        if (wildCards.length > 0) return wildCards[0];

        // Fallback
        return playable[0];
    }

    /**
     * Pick the best color when playing a wild card.
     * Choose the color that appears most in the bot's remaining hand.
     */
    _pickBestColor(hand, playedCard) {
        const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };
        for (const c of hand) {
            if (c.id !== playedCard.id && c.color && colorCounts[c.color] !== undefined) {
                colorCounts[c.color]++;
            }
        }

        const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
        // If all zero (only wilds left), pick random
        if (sorted[0][1] === 0) {
            const colorArr = [COLORS.RED, COLORS.BLUE, COLORS.GREEN, COLORS.YELLOW];
            return colorArr[Math.floor(Math.random() * colorArr.length)];
        }
        return sorted[0][0];
    }

    /**
     * Should the bot call UNO? (always yes when at 1-2 cards)
     */
    shouldCallUno(handSize) {
        // Occasionally "forget" on easy mode
        if (this.difficultyName === 'easy' && Math.random() < 0.3) return false;
        return handSize <= 2;
    }

    /** Get think time in ms (with slight randomness) */
    getThinkTime() {
        const base = this.difficulty.thinkTimeMs;
        return base + Math.random() * 1000; // add 0-1s jitter
    }
}

module.exports = BotPlayer;
