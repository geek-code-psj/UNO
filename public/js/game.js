// public/js/game.js — Game board rendering and interaction

let gameState = null;
let playerHand = [];
let selectedCard = null;
let pendingWildCard = null;
let turnTimerInterval = null;
let turnStartedAt = null;

const TURN_DURATION = 30; // seconds

// ── Audio Helpers ───────────────────────────────────────
function playSound(type) {
    if (window.audioManager) window.audioManager.play(type);
}

// ── Card Display Helpers ────────────────────────────────
function getCardSymbol(card) {
    if (!card) return '?';
    switch (card.type) {
        case 'number': return card.value;
        case 'skip': return '🚫';
        case 'reverse': return '⇄';
        case 'draw_two': return '+2';
        case 'wild': return 'W';
        case 'wild_draw_four': return '+4';
        default: return '?';
    }
}

function getCardColorClass(card) {
    if (!card) return '';
    if (card.type === 'wild' || card.type === 'wild_draw_four') return 'wild';
    return card.color || '';
}

/**
 * Generates the HTML for a card using the new CSS-only design
 */
function getCardHTML(card, extraClasses = '', onclick = '') {
    const symbol = getCardSymbol(card);
    const colorClass = getCardColorClass(card);
    const typeClass = card.type;

    return `
    <div class="uno-card ${colorClass} ${extraClasses}" 
         onclick="${onclick}"
         data-id="${card.id}">
      <div class="inner">
        <div class="mark-corner tl">${symbol}</div>
        <div class="oval">
          <div class="mark-main">${symbol}</div>
        </div>
        <div class="mark-corner br">${symbol}</div>
      </div>
    </div>
    `;
}

function getDiscardCardHTML(card) {
    const symbol = getCardSymbol(card);
    const colorClass = gameState.chosenColor || getCardColorClass(card);
    // Randomize rotation slightly for natural feel
    const rotation = (Math.random() * 10 - 5).toFixed(1);

    return `
    <div class="discard-card ${colorClass}" style="--r:${rotation}deg">
      <div class="inner">
        <div class="mark-corner tl">${symbol}</div>
        <div class="oval">
          <div class="mark-main">${symbol}</div>
        </div>
        <div class="mark-corner br">${symbol}</div>
      </div>
    </div>
    `;
}

function getActiveColor() {
    if (!gameState) return null;
    return gameState.chosenColor || gameState.topCard?.color || null;
}

// ── Game State Handler ──────────────────────────────────
function handleGameState(state) {
    // Detect changes for sound effects
    const prevTurn = gameState?.currentPlayer?.id;
    const newTurn = state.currentPlayer?.id;

    // Play turn sound if it just became my turn
    if (newTurn === currentUser?.id && prevTurn !== currentUser?.id) {
        playSound('turn');
    }

    gameState = state;

    // Switch to game view
    document.getElementById('lobby-page').classList.add('hidden');
    document.getElementById('waiting-room-page').classList.add('hidden');
    document.getElementById('game-page').classList.remove('hidden');

    renderOpponents();
    renderDiscardPile();
    renderDeckCount();
    updateDirectionIndicator();
    updateTurnIndicator();
    startTurnTimer();
}

// ── Render Opponents ────────────────────────────────────
function renderOpponents() {
    if (!gameState) return;
    const container = document.getElementById('opponents-area');
    const myId = currentUser?.id;

    // Ensure consistent order (rotate so I am at bottom, others clockwise)
    const allPlayers = gameState.playerCardCounts;
    const myIndex = allPlayers.findIndex(p => p.id === myId);

    // Reorder array to put me last (so I'm "bottom"), then take the rest
    // Actually for opponents area we just want everyone EXCEPT me
    const opponents = allPlayers.filter(p => p.id !== myId);

    container.innerHTML = opponents.map(p => {
        const isCurrentTurn = gameState.currentPlayer && gameState.currentPlayer.id === p.id;
        // Cap visual cards at 5 to prevent UI clutter
        const visualCardCount = Math.min(p.cardCount, 5);
        const cardBacks = Array(visualCardCount).fill(0)
            .map(() => `<div class="card-back-mini"></div>`).join('');

        return `
      <div class="opponent ${isCurrentTurn ? 'active-turn' : ''}" id="opp-${p.id}">
        <span class="opponent-avatar">${p.isBot ? '🤖' : '👤'}</span>
        <div class="opponent-info" style="text-align:center; margin-top:4px">
            <div style="font-weight:bold; font-size:0.9rem">${p.username}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary)">${p.cardCount} cards</div>
        </div>
        <div class="opponent-cards">${cardBacks}</div>
        ${p.cardCount === 1 ? '<span style="color:var(--uno-yellow);font-weight:900;animation:pulse 1s infinite">UNO!</span>' : ''}
      </div>
    `;
    }).join('');
}

// ── Render Discard Pile ─────────────────────────────────
function renderDiscardPile() {
    if (!gameState || !gameState.topCard) return;
    const pile = document.getElementById('discard-pile');

    // Check if new card (optimization)
    const currentHTML = pile.innerHTML;
    const newHTML = getDiscardCardHTML(gameState.topCard);

    // Only re-render if changed to allow animation to play
    // Simple check: compare symbol/type/color
    // Ideally we'd compare IDs but topCard object might be new ref

    pile.innerHTML = newHTML;

    // Update the active color banner
    renderActiveColorBanner();
}

// ── Active Color Banner ─────────────────────────────────
function renderActiveColorBanner() {
    let banner = document.getElementById('active-color-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'active-color-banner';
        banner.className = 'active-color-banner';
        const centerArea = document.querySelector('.center-area');
        if (centerArea) centerArea.after(banner);
    }

    const color = getActiveColor();
    if (color) {
        const colorNames = { red: 'RED', blue: 'BLUE', green: 'GREEN', yellow: 'YELLOW' };
        const colorHex = { red: '#ff3344', blue: '#3388ff', green: '#33ff66', yellow: '#ffcc00' };

        banner.innerHTML = `
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${colorHex[color]};margin-right:8px;box-shadow:0 0 10px ${colorHex[color]}"></span>
            ${colorNames[color] || color.toUpperCase()}
        `;
        banner.style.color = colorHex[color];
        banner.style.borderColor = colorHex[color];
        banner.style.display = 'flex';
        banner.style.boxShadow = `0 0 20px ${colorHex[color]}40`;
    } else {
        banner.style.display = 'none';
    }
}

// ── Render Deck Count ───────────────────────────────────
function renderDeckCount() {
    if (!gameState) return;
    // We removed the text count from inside the deck to make it cleaner
    // But we can add it back as a small badge if needed or just keep the visual pile
    // For now let's update a tooltip or separate counter if it exists
    const deckCountEl = document.getElementById('deck-count');
    if (deckCountEl) deckCountEl.textContent = gameState.deckRemaining;
}

// ── Update Direction Indicator ──────────────────────────
function updateDirectionIndicator() {
    if (!gameState) return;
    const indicator = document.getElementById('direction-indicator');
    if (gameState.direction === 1) {
        indicator.classList.remove('reverse');
    } else {
        indicator.classList.add('reverse');
    }
}

// ── Update Turn Indicator ───────────────────────────────
function updateTurnIndicator() {
    if (!gameState) return;
    const isMyTurn = gameState.currentPlayer && gameState.currentPlayer.id === currentUser?.id;
    const handArea = document.querySelector('.player-hand-area');
    const unoBtn = document.getElementById('uno-btn');

    if (isMyTurn) {
        handArea.classList.add('turn-active-glow');
    } else {
        handArea.classList.remove('turn-active-glow');
    }

    // Show UNO button when player has 2 cards (about to have 1)
    if (playerHand.length <= 2 && playerHand.length > 0) {
        unoBtn.classList.remove('hidden');
    } else {
        unoBtn.classList.add('hidden');
    }
}

// ── Render Player's Hand ────────────────────────────────
function renderHand(hand) {
    playerHand = hand || [];
    const container = document.getElementById('hand-container');
    const isMyTurn = gameState?.currentPlayer?.id === currentUser?.id;

    container.innerHTML = playerHand.map((card, i) => {
        const canPlay = isMyTurn && isCardPlayable(card);
        const selected = selectedCard === card.id ? 'selected' : '';
        // "disabled" class for dimming
        const extraClasses = `${selected} ${(!canPlay && isMyTurn ? 'disabled' : '')}`;

        return getCardHTML(card, extraClasses, `selectCard('${card.id}', ${i})`);
    }).join('');

    updateTurnIndicator();
}

// ── Check if card is playable ───────────────────────────
function isCardPlayable(card) {
    if (!gameState || !gameState.topCard) return false;
    if (card.type === 'wild' || card.type === 'wild_draw_four') return true;

    const activeColor = gameState.chosenColor || gameState.topCard.color;
    if (card.color === activeColor) return true;

    if (card.type === 'number' && gameState.topCard.type === 'number') {
        return card.value === gameState.topCard.value;
    }

    return card.type === gameState.topCard.type;
}

// ── Select / Play Card ──────────────────────────────────
function selectCard(cardId, index) {
    const isMyTurn = gameState?.currentPlayer?.id === currentUser?.id;
    if (!isMyTurn) {
        playSound('error');
        return;
    }

    const card = playerHand.find(c => c.id === cardId);
    if (!card) return;

    if (!isCardPlayable(card)) {
        playSound('error');
        showToast('Cannot play this card', 'error');
        return;
    }

    playSound('click');

    // If card already selected or click-to-play enabled (implied), play it
    // For smoother UX, let's just make it double-click or simple click if we want fast play
    // But sticking to select->play for safety. Actually, let's do click-to-play if already selected OR just play immediately
    // Ideally: Click once to lift (select), click again to play.

    if (selectedCard === cardId) {
        playSelectedCard(card);
        return;
    }

    selectedCard = cardId;
    renderHand(playerHand);
}

function playSelectedCard(card) {
    // Wild handling
    if (card.type === 'wild' || card.type === 'wild_draw_four') {
        pendingWildCard = card;
        document.getElementById('color-picker').classList.remove('hidden');
        playSound('alert');
        return;
    }

    playSound('play');
    // Animate visual removal immediately for responsiveness
    // (We'll rely on server update to canonicalize state)
    socket.emit('game:play', { cardId: card.id, chosenColor: null });
    selectedCard = null;

    // Optimistic UI update could go here
}

function chooseColor(color) {
    document.getElementById('color-picker').classList.add('hidden');
    if (pendingWildCard) {
        playSound('play');
        socket.emit('game:play', { cardId: pendingWildCard.id, chosenColor: color });
        pendingWildCard = null;
        selectedCard = null;
    }
}

// ── Draw Card ───────────────────────────────────────────
function drawCard() {
    const isMyTurn = gameState?.currentPlayer?.id === currentUser?.id;
    if (!isMyTurn) {
        playSound('error');
        showToast('Not your turn!', 'error');
        return;
    }

    playSound('draw');
    // Add visual animation of card flying to hand here if possible

    socket.emit('game:draw');
    selectedCard = null;
}

// ── Call UNO ────────────────────────────────────────────
function callUno() {
    socket.emit('game:uno');
    playSound('uno');
    showEventOverlay('UNO!');
    showToast('UNO! 🎯', 'success');
}

// ── Turn Timer ──────────────────────────────────────────
function startTurnTimer() {
    clearInterval(turnTimerInterval);
    turnStartedAt = Date.now();

    const fill = document.getElementById('timer-fill');

    turnTimerInterval = setInterval(() => {
        const elapsed = (Date.now() - turnStartedAt) / 1000;
        const remaining = Math.max(0, TURN_DURATION - elapsed);
        const pct = (remaining / TURN_DURATION) * 100;

        const seconds = document.getElementById('timer-seconds');

        if (fill) {
            fill.style.width = pct + '%';
            if (remaining < 5 && !fill.classList.contains('danger')) {
                fill.className = 'timer-fill danger';
                // playSound('tick'); // Optional ticking sound
            } else if (remaining < 10 && remaining >= 5) {
                fill.className = 'timer-fill warning';
            } else if (remaining >= 10) {
                fill.className = 'timer-fill';
            }
        }
        if (seconds) seconds.textContent = Math.ceil(remaining);

        if (remaining <= 0) clearInterval(turnTimerInterval);
    }, 200);
}

// ── Game Over ───────────────────────────────────────────
function handleGameOver(data) {
    clearInterval(turnTimerInterval);

    const modal = document.getElementById('gameover-modal');
    const title = document.getElementById('gameover-title');
    const content = document.getElementById('gameover-content');

    const isWinner = data.winner === currentUser?.id;
    title.textContent = isWinner ? '🎉 You Win!' : '😢 Game Over';

    if (isWinner) playSound('win');
    else playSound('error');

    const winnerName = data.state?.playerCardCounts?.find(p => p.id === data.winner)?.username || 'Unknown';

    let html = `<p style="margin-bottom:16px;font-size:1.5rem;color:var(--text-secondary)">
    Winner: <strong style="color:var(--uno-yellow)">${winnerName}</strong>
  </p>`;

    if (data.scores) {
        html += `<div style="text-align:left">
      <h3 style="margin-bottom:12px">📊 Scores</h3>
      <table class="leaderboard-table">
        <tr><th>Player</th><th>Score</th></tr>
        ${Object.entries(data.scores).map(([id, score]) => {
            const name = data.state?.playerCardCounts?.find(p => p.id === id)?.username || id;
            return `<tr><td>${name} ${id === data.winner ? '👑' : ''}</td><td>${score}</td></tr>`;
        }).join('')}
      </table>
    </div>`;
    }

    if (isWinner) {
        html += `<p style="margin-top:16px;color:var(--uno-yellow);font-weight:600">+50 coins earned! 🪙</p>`;
    } else {
        html += `<p style="margin-top:16px;color:var(--text-secondary)">+10 coins for participating</p>`;
    }

    content.innerHTML = html;
    modal.classList.remove('hidden');
}

// ── Helpers ─────────────────────────────────────────────
function showEventOverlay(text) {
    const el = document.createElement('div');
    el.className = 'event-overlay';
    el.innerText = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

// ── Floating Emoji ──────────────────────────────────────
function showFloatingEmoji(emoji) {
    const el = document.createElement('div');
    el.textContent = emoji;
    el.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    font-size: 4rem;
    z-index: 1000;
    pointer-events: none;
    text-shadow: 0 0 20px rgba(255,255,255,0.5);
    animation: floatUp 1.5s ease forwards;
  `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// Add float animation keyframes if not present
if (!document.getElementById('anim-styles')) {
    const s = document.createElement('style');
    s.id = 'anim-styles';
    s.textContent = `
      @keyframes floatUp {
        0% { opacity: 0; transform: translate(-50%, -40%) scale(0.5); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
        100% { opacity: 0; transform: translate(-50%, -150%) scale(1); }
      }
    `;
    document.head.appendChild(s);
}
