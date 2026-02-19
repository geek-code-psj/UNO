// public/js/offline-engine.js — Full client-side UNO game engine for offline play
// This is a self-contained engine that runs entirely in the browser with no server needed.

const OfflineEngine = (() => {
    // ── Constants ────────────────────────────────────────
    const COLORS = ['red', 'blue', 'green', 'yellow'];
    const CARD_TYPES = {
        NUMBER: 'number',
        SKIP: 'skip',
        REVERSE: 'reverse',
        DRAW_TWO: 'draw_two',
        WILD: 'wild',
        WILD_DRAW_FOUR: 'wild_draw_four',
    };

    let cardIdCounter = 0;
    function nextCardId() { return `c_${++cardIdCounter}`; }

    // ── Official UNO Rules Reference ──────────────────────
    // Source: Official Mattel UNO rules (2024 edition)
    //
    // DECK: 108 cards total
    //   - 76 Number cards: 0-9 in each of 4 colors (one 0, two of each 1-9)
    //   - 8 Skip cards: 2 per color
    //   - 8 Reverse cards: 2 per color
    //   - 8 Draw Two cards: 2 per color
    //   - 4 Wild cards (no color)
    //   - 4 Wild Draw Four cards (no color)
    //
    // SETUP:
    //   - Each player dealt 7 cards
    //   - Top card of draw pile flipped to start discard
    //   - If first card is action card, its effect applies to first player
    //   - If first card is Wild Draw Four, reshuffle and reflip
    //
    // PLAYING A CARD:
    //   - Must match color, number, or symbol of top discard
    //   - Wild cards can be played on anything
    //   - Wild Draw Four can ONLY be played when you have NO cards
    //     matching the current color (challenge rule applies)
    //   - If you cannot play, draw ONE card. If it can be played, you
    //     MAY play it immediately. If not, turn passes.
    //
    // POWER CARD EFFECTS:
    //   - SKIP: Next player loses their turn
    //   - REVERSE: Reverses direction of play. In 2-player, acts as Skip
    //   - DRAW TWO (+2): Next player draws 2 cards AND loses their turn.
    //     Official rules: +2 CANNOT be stacked on +2.
    //   - WILD: Player declares next color. Can be played on any turn.
    //   - WILD DRAW FOUR (+4): Player declares next color. Next player
    //     draws 4 AND loses their turn. Can only be played when you have
    //     NO cards of the current color.
    //     CHALLENGE: The next player may challenge. If the player DID have
    //     a matching color card, THEY draw 4 instead. If challenge fails,
    //     challenger draws 6 (4 + 2 penalty).
    //
    // UNO CALL:
    //   - Must call "UNO!" when playing second-to-last card (going to 1 card)
    //   - If caught not calling UNO before next player plays, draw 2 penalty
    //
    // SCORING:
    //   - Number cards: face value (0-9 points)
    //   - Skip / Reverse / Draw Two: 20 points each
    //   - Wild / Wild Draw Four: 50 points each
    //   - Winner earns sum of all other players' remaining hands

    // ── Build Official 108-card Deck ─────────────────────
    function buildDeck() {
        const cards = [];
        for (const color of COLORS) {
            // One 0 card per color
            cards.push({ id: nextCardId(), color, type: CARD_TYPES.NUMBER, value: 0 });
            // Two each of 1-9
            for (let n = 1; n <= 9; n++) {
                cards.push({ id: nextCardId(), color, type: CARD_TYPES.NUMBER, value: n });
                cards.push({ id: nextCardId(), color, type: CARD_TYPES.NUMBER, value: n });
            }
            // Two each of Skip, Reverse, Draw Two per color
            for (let i = 0; i < 2; i++) {
                cards.push({ id: nextCardId(), color, type: CARD_TYPES.SKIP, value: null });
                cards.push({ id: nextCardId(), color, type: CARD_TYPES.REVERSE, value: null });
                cards.push({ id: nextCardId(), color, type: CARD_TYPES.DRAW_TWO, value: null });
            }
        }
        // 4 Wild + 4 Wild Draw Four
        for (let i = 0; i < 4; i++) {
            cards.push({ id: nextCardId(), color: null, type: CARD_TYPES.WILD, value: null });
            cards.push({ id: nextCardId(), color: null, type: CARD_TYPES.WILD_DRAW_FOUR, value: null });
        }
        return cards; // 108 cards total
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ── Card Validation ──────────────────────────────────
    function canPlayCard(card, topCard, chosenColor, hand) {
        // Wild cards can always be played
        if (card.type === CARD_TYPES.WILD) return true;

        // Wild Draw Four: official rule — can only play if you have
        // NO card matching the current active color
        if (card.type === CARD_TYPES.WILD_DRAW_FOUR) {
            const activeColor = chosenColor || topCard.color;
            const hasMatchingColor = hand.some(c =>
                c.id !== card.id && c.color === activeColor
            );
            // Can play it even if you have matching (bluff), but it can be challenged
            return true; // allow playing, challenge handles legality
        }

        // Match color
        const activeColor = chosenColor || topCard.color;
        if (card.color === activeColor) return true;

        // Match number
        if (card.type === CARD_TYPES.NUMBER && topCard.type === CARD_TYPES.NUMBER) {
            return card.value === topCard.value;
        }

        // Match action type
        if (card.type === topCard.type) return true;

        return false;
    }

    // ── Check if Wild Draw Four was legally played ───────
    function wasWildDrawFourLegal(hand, activeColor) {
        // Legal if player had NO cards of the active color
        return !hand.some(c => c.color === activeColor);
    }

    // ── Scoring ──────────────────────────────────────────
    function scoreHand(hand) {
        return hand.reduce((s, c) => {
            if (c.type === CARD_TYPES.NUMBER) return s + c.value;
            if (c.type === CARD_TYPES.SKIP || c.type === CARD_TYPES.REVERSE || c.type === CARD_TYPES.DRAW_TWO) return s + 20;
            if (c.type === CARD_TYPES.WILD || c.type === CARD_TYPES.WILD_DRAW_FOUR) return s + 50;
            return s;
        }, 0);
    }

    // ── Bot AI (runs locally, no server) ─────────────────
    const BOT_NAMES = [
        '🤖 RoboUno', '🤖 CardMaster', '🤖 BotBoss', '🤖 MegaBot',
        '🤖 UnoBot', '🤖 AIPlayer', '🤖 DeepPlay', '🤖 SmartDeck',
    ];
    const BOT_DIFFICULTY = {
        easy: { smartChance: 0.3, thinkMs: 1200 },
        medium: { smartChance: 0.65, thinkMs: 900 },
        hard: { smartChance: 0.92, thinkMs: 600 },
    };

    function createBot(difficulty = 'medium') {
        return {
            id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            username: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
            isBot: true,
            diff: BOT_DIFFICULTY[difficulty] || BOT_DIFFICULTY.medium,
            diffName: difficulty,
        };
    }

    function botDecideMove(bot, hand, topCard, chosenColor, state) {
        const playable = hand.filter(c => canPlayCard(c, topCard, chosenColor, hand));
        if (playable.length === 0) return { action: 'draw' };

        const smart = Math.random() < bot.diff.smartChance;
        let chosen;

        if (smart) {
            const opponentClose = state.playerCardCounts?.some(
                p => p.id !== bot.id && p.cardCount <= 2
            );
            const drawCards = playable.filter(c => c.type === CARD_TYPES.DRAW_TWO || c.type === CARD_TYPES.WILD_DRAW_FOUR);
            const actionCards = playable.filter(c => c.type === CARD_TYPES.SKIP || c.type === CARD_TYPES.REVERSE);
            const numberCards = playable.filter(c => c.type === CARD_TYPES.NUMBER);
            const wildCards = playable.filter(c => c.type === CARD_TYPES.WILD);

            if (opponentClose && drawCards.length > 0) { chosen = drawCards[0]; }
            else if (hand.length <= 3 && actionCards.length > 0) { chosen = actionCards[0]; }
            else {
                // Play dominant color
                const cc = {};
                hand.forEach(c => { if (c.color) cc[c.color] = (cc[c.color] || 0) + 1; });
                const dom = Object.entries(cc).sort((a, b) => b[1] - a[1])[0]?.[0];
                const domNum = numberCards.filter(c => c.color === dom);
                if (domNum.length > 0) chosen = domNum.sort((a, b) => b.value - a.value)[0];
                else if (numberCards.length > 0) chosen = numberCards.sort((a, b) => b.value - a.value)[0];
                else if (actionCards.length > 0) chosen = actionCards[0];
                else if (drawCards.length > 0) chosen = drawCards[0];
                else if (wildCards.length > 0) chosen = wildCards[0];
                else chosen = playable[0];
            }
        } else {
            chosen = playable[Math.floor(Math.random() * playable.length)];
        }

        let colorChoice = null;
        if (chosen.type === CARD_TYPES.WILD || chosen.type === CARD_TYPES.WILD_DRAW_FOUR) {
            const cc = { red: 0, blue: 0, green: 0, yellow: 0 };
            hand.forEach(c => { if (c.id !== chosen.id && c.color && cc[c.color] !== undefined) cc[c.color]++; });
            const sorted = Object.entries(cc).sort((a, b) => b[1] - a[1]);
            colorChoice = sorted[0][1] > 0 ? sorted[0][0] : COLORS[Math.floor(Math.random() * 4)];
        }
        return { action: 'play', cardId: chosen.id, chosenColor: colorChoice };
    }

    // ── Main Offline Game Class ──────────────────────────
    class OfflineGame {
        constructor(botCount = 1, difficulty = 'medium') {
            cardIdCounter = 0;
            this.playerId = 'player_1';
            this.playerName = 'You';
            this.bots = [];
            for (let i = 0; i < Math.min(botCount, 3); i++) {
                this.bots.push(createBot(difficulty));
            }
            this.players = [
                { id: this.playerId, username: this.playerName, isBot: false },
                ...this.bots.map(b => ({ id: b.id, username: b.username, isBot: true })),
            ];
            this.hands = {};
            this.drawPile = [];
            this.discardPile = [];
            this.currentPlayerIndex = 0;
            this.direction = 1;
            this.chosenColor = null;
            this.state = 'waiting';
            this.winner = null;
            this.scores = {};
            this.unoCalledBy = new Set();
            this.lastPlayedWD4Hand = null; // for challenge tracking
            this.lastPlayedWD4Color = null;
            this.pendingChallenge = false;
            this.eventLog = [];
            this.onUpdate = null; // callback for UI
            this.onBotPlay = null;
            this.onGameOver = null;
        }

        start() {
            this.drawPile = shuffle(buildDeck());
            this.state = 'playing';

            // Deal 7 cards each
            for (const p of this.players) {
                this.hands[p.id] = this.drawPile.splice(0, 7);
            }

            // Flip first card (must be a number)
            let firstCard;
            do {
                firstCard = this.drawPile.shift();
                if (firstCard.type !== CARD_TYPES.NUMBER) {
                    this.drawPile.push(firstCard);
                    shuffle(this.drawPile);
                }
            } while (firstCard.type !== CARD_TYPES.NUMBER);
            this.discardPile.push(firstCard);

            this.currentPlayerIndex = 0;
            this._log(`Game started! First card: ${this._cardName(firstCard)}`);
            this._emitUpdate();

            // If first player is a bot, schedule their turn
            if (this.getCurrentPlayer().isBot) {
                this._scheduleBotTurn();
            }
        }

        getCurrentPlayer() { return this.players[this.currentPlayerIndex]; }

        getTopCard() { return this.discardPile[this.discardPile.length - 1]; }

        getPlayerHand() { return this.hands[this.playerId] || []; }

        getState() {
            return {
                state: this.state,
                currentPlayer: this.getCurrentPlayer(),
                direction: this.direction,
                topCard: this.getTopCard(),
                chosenColor: this.chosenColor,
                deckRemaining: this.drawPile.length,
                playerCardCounts: this.players.map(p => ({
                    id: p.id,
                    username: p.username,
                    cardCount: (this.hands[p.id] || []).length,
                    isBot: p.isBot,
                })),
                players: this.players,
                winner: this.winner,
                scores: this.scores,
                eventLog: this.eventLog.slice(-8),
            };
        }

        // ── Play a card ──────────────────────────────────
        playCard(playerId, cardId, chosenColor) {
            if (this.state !== 'playing') return { success: false, error: 'Game not in progress' };
            if (this.getCurrentPlayer().id !== playerId) return { success: false, error: 'Not your turn' };

            const hand = this.hands[playerId];
            const idx = hand.findIndex(c => c.id === cardId);
            if (idx === -1) return { success: false, error: 'Card not in hand' };

            const card = hand[idx];
            const topCard = this.getTopCard();

            if (!canPlayCard(card, topCard, this.chosenColor, hand)) {
                return { success: false, error: 'Cannot play this card here' };
            }

            // Wild Draw Four requires a chosen color
            if ((card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) && !chosenColor) {
                return { success: false, error: 'Must choose a color' };
            }

            // Remove card from hand
            hand.splice(idx, 1);
            this.discardPile.push(card);

            // Set chosen color
            if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
                this.chosenColor = chosenColor;
            } else {
                this.chosenColor = null;
            }

            const playerName = this.players.find(p => p.id === playerId)?.username || playerId;

            // Check for win
            if (hand.length === 0) {
                return this._handleWin(playerId);
            }

            // Apply card effect
            const effect = this._applyEffect(card, playerId);
            this._log(`${playerName} played ${this._cardName(card)}${effect.msg ? ' — ' + effect.msg : ''}`);
            this._emitUpdate();

            // Schedule bot turn if next is bot
            if (this.getCurrentPlayer().isBot) {
                this._scheduleBotTurn();
            }

            return { success: true, card, effect };
        }

        // ── Draw a card ──────────────────────────────────
        drawCard(playerId) {
            if (this.state !== 'playing') return { success: false, error: 'Game not in progress' };
            if (this.getCurrentPlayer().id !== playerId) return { success: false, error: 'Not your turn' };

            this._recycleIfNeeded();
            const card = this.drawPile.shift();
            if (!card) return { success: false, error: 'No cards left' };

            this.hands[playerId].push(card);

            // Official rule: if drawn card CAN be played, player may play it.
            // For bots this is handled automatically; for human, UI shows option.
            const canPlay = canPlayCard(card, this.getTopCard(), this.chosenColor, this.hands[playerId]);

            const playerName = this.players.find(p => p.id === playerId)?.username || playerId;
            this._log(`${playerName} drew a card`);

            // Advance turn
            this._nextTurn();
            this._emitUpdate();

            // Schedule bot turn if next is bot
            if (this.getCurrentPlayer().isBot) {
                this._scheduleBotTurn();
            }

            return { success: true, card, canPlay };
        }

        // ── Call UNO ──────────────────────────────────────
        callUno(playerId) {
            if (this.hands[playerId] && this.hands[playerId].length <= 2) {
                this.unoCalledBy.add(playerId);
                const name = this.players.find(p => p.id === playerId)?.username;
                this._log(`${name} called UNO! 🎯`);
                this._emitUpdate();
                return { success: true };
            }
            return { success: false, error: 'Can only call UNO with 1-2 cards' };
        }

        // ── Challenge UNO (when someone has 1 card without calling) ──
        challengeUno(challengerId, targetId) {
            if (!this.hands[targetId] || this.hands[targetId].length !== 1) {
                return { success: false, error: 'Target does not have exactly 1 card' };
            }
            if (this.unoCalledBy.has(targetId)) {
                return { success: false, error: 'They already called UNO' };
            }

            // Official penalty: draw 2
            this._recycleIfNeeded();
            const penalty = this.drawPile.splice(0, 2);
            this.hands[targetId].push(...penalty);

            const challengerName = this.players.find(p => p.id === challengerId)?.username;
            const targetName = this.players.find(p => p.id === targetId)?.username;
            this._log(`${challengerName} caught ${targetName} not calling UNO! +2 penalty cards`);
            this._emitUpdate();

            return { success: true, penaltyCards: 2 };
        }

        // ── Effect Application (Official Rules) ──────────
        _applyEffect(card, playerId) {
            let msg = '';

            switch (card.type) {
                case CARD_TYPES.SKIP: {
                    this._nextTurn();
                    const skipped = this.getCurrentPlayer();
                    msg = `${skipped.username} skipped!`;
                    this._nextTurn();
                    break;
                }
                case CARD_TYPES.REVERSE: {
                    if (this.players.length === 2) {
                        // In 2-player, reverse acts as skip (official rule)
                        this._nextTurn();
                        const skipped = this.getCurrentPlayer();
                        msg = `Direction reversed! ${skipped.username} skipped (2-player rule)`;
                        this._nextTurn();
                    } else {
                        this.direction *= -1;
                        msg = `Direction reversed! (${this.direction === 1 ? 'Clockwise ↻' : 'Counter-clockwise ↺'})`;
                        this._nextTurn();
                    }
                    break;
                }
                case CARD_TYPES.DRAW_TWO: {
                    this._nextTurn();
                    const target = this.getCurrentPlayer();
                    this._recycleIfNeeded();
                    const drawn = this.drawPile.splice(0, 2);
                    this.hands[target.id].push(...drawn);
                    msg = `${target.username} draws 2 cards and loses turn!`;
                    this._nextTurn();
                    break;
                }
                case CARD_TYPES.WILD: {
                    msg = `Color changed to ${this.chosenColor}`;
                    this._nextTurn();
                    break;
                }
                case CARD_TYPES.WILD_DRAW_FOUR: {
                    // Track for potential challenge
                    this.lastPlayedWD4Hand = [...(this.hands[playerId] || [])];
                    this.lastPlayedWD4Color = this.chosenColor;
                    this._nextTurn();
                    const target4 = this.getCurrentPlayer();
                    this._recycleIfNeeded();
                    const drawn4 = this.drawPile.splice(0, 4);
                    this.hands[target4.id].push(...drawn4);
                    msg = `${target4.username} draws 4 cards and loses turn! Color → ${this.chosenColor}`;
                    this._nextTurn();
                    break;
                }
                default: {
                    // Number card — no special effect
                    this._nextTurn();
                    break;
                }
            }
            return { type: card.type, msg };
        }

        // ── Turn Management ──────────────────────────────
        _nextTurn() {
            this.unoCalledBy.clear();
            this.currentPlayerIndex += this.direction;
            if (this.currentPlayerIndex >= this.players.length) this.currentPlayerIndex = 0;
            if (this.currentPlayerIndex < 0) this.currentPlayerIndex = this.players.length - 1;
        }

        _scheduleTimeout = null;
        _scheduleBotTurn() {
            if (this._scheduleTimeout) clearTimeout(this._scheduleTimeout);
            const bot = this.bots.find(b => b.id === this.getCurrentPlayer().id);
            if (!bot || this.state !== 'playing') return;

            const thinkTime = bot.diff.thinkMs + Math.random() * 800;
            this._scheduleTimeout = setTimeout(() => {
                this._executeBotTurn(bot);
            }, thinkTime);
        }

        _executeBotTurn(bot) {
            if (this.state !== 'playing' || this.getCurrentPlayer().id !== bot.id) return;

            const hand = this.hands[bot.id];
            const topCard = this.getTopCard();
            const move = botDecideMove(bot, hand, topCard, this.chosenColor, this.getState());

            // Call UNO if needed
            if (hand.length <= 2 && !(bot.diffName === 'easy' && Math.random() < 0.3)) {
                this.callUno(bot.id);
            }

            let result;
            if (move.action === 'play') {
                result = this.playCard(bot.id, move.cardId, move.chosenColor);
            } else {
                result = this.drawCard(bot.id);
            }

            if (this.onBotPlay) this.onBotPlay(bot, move, result);
        }

        // ── Win Handling ─────────────────────────────────
        _handleWin(winnerId) {
            this.state = 'finished';
            this.winner = winnerId;
            if (this._scheduleTimeout) clearTimeout(this._scheduleTimeout);

            this.scores = {};
            let total = 0;
            for (const p of this.players) {
                if (p.id !== winnerId) {
                    const s = scoreHand(this.hands[p.id] || []);
                    this.scores[p.id] = s;
                    total += s;
                }
            }
            this.scores[winnerId] = total;

            const winnerName = this.players.find(p => p.id === winnerId)?.username;
            this._log(`🏆 ${winnerName} WINS with ${total} points!`);
            this._emitUpdate();
            if (this.onGameOver) this.onGameOver(winnerId, this.scores);

            return { success: true, gameOver: true, winner: winnerId, scores: this.scores };
        }

        // ── Deck Recycling ───────────────────────────────
        _recycleIfNeeded() {
            if (this.drawPile.length < 4) {
                // Keep top card of discard, shuffle rest back into draw
                const topCard = this.discardPile.pop();
                this.drawPile.push(...shuffle(this.discardPile));
                this.discardPile = [topCard];
            }
        }

        // ── Helpers ──────────────────────────────────────
        _cardName(card) {
            const names = {
                skip: 'Skip', reverse: 'Reverse', draw_two: 'Draw Two',
                wild: 'Wild', wild_draw_four: 'Wild Draw Four',
            };
            if (card.type === 'number') return `${card.color} ${card.value}`;
            if (card.color) return `${card.color} ${names[card.type]}`;
            return names[card.type] || card.type;
        }

        _log(msg) {
            this.eventLog.push({ text: msg, time: Date.now() });
            if (this.eventLog.length > 50) this.eventLog.shift();
        }

        _emitUpdate() {
            if (this.onUpdate) this.onUpdate(this.getState());
        }
    }

    // Expose
    return { OfflineGame, CARD_TYPES, COLORS, canPlayCard, scoreHand };
})();
