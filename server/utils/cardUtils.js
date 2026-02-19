// server/utils/cardUtils.js
const { COLORS, CARD_TYPES } = require('./constants');

/**
 * Check if a card can be played on top of the discard pile
 */
function canPlayCard(card, topCard, chosenColor) {
    // Wild cards can always be played
    if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
        return true;
    }

    // Match color (use chosenColor if a wild was played)
    const activeColor = chosenColor || topCard.color;
    if (card.color === activeColor) return true;

    // Match number or type
    if (card.type === CARD_TYPES.NUMBER && topCard.type === CARD_TYPES.NUMBER) {
        return card.value === topCard.value;
    }

    // Match action type
    if (card.type === topCard.type) return true;

    return false;
}

/**
 * Calculate hand score (for end-of-round scoring)
 */
function calculateHandScore(hand) {
    return hand.reduce((score, card) => {
        if (card.type === CARD_TYPES.NUMBER) return score + card.value;
        if (card.type === CARD_TYPES.SKIP || card.type === CARD_TYPES.REVERSE || card.type === CARD_TYPES.DRAW_TWO) return score + 20;
        if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) return score + 50;
        return score;
    }, 0);
}

/**
 * Generate a unique card ID
 */
let cardIdCounter = 0;
function nextCardId() {
    return `card_${++cardIdCounter}`;
}

function resetCardIdCounter() {
    cardIdCounter = 0;
}

module.exports = { canPlayCard, calculateHandScore, nextCardId, resetCardIdCounter };
