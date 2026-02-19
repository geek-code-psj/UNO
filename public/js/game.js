// public/js/game.js — Game board rendering and interaction

let gameState = null;
let playerHand = [];
let selectedCard = null;
let pendingWildCard = null;
let turnTimerInterval = null;
let turnStartedAt = null;

const TURN_DURATION = 30; // seconds

// ── Card Display Helpers ────────────────────────────────
function getCardSymbol(card) {
    if (!card) return '?';
    switch (card.type) {
        case 'number': return card.value;
        case 'skip': return '⛔';
        case 'reverse': return '🔄';
        case 'draw_two': return '+2';
        case 'wild': return '🌈';
        case 'wild_draw_four': return '+4';
        default: return '?';
    }
}

function getCardLabel(card) {
    if (!card) return '';
    switch (card.type) {
        case 'number': return '';
        case 'skip': return 'SKIP';
        case 'reverse': return 'REVERSE';
        case 'draw_two': return 'DRAW 2';
        case 'wild': return 'WILD';
        case 'wild_draw_four': return 'WILD +4';
        default: return '';
    }
}

function getActiveColor() {
    if (!gameState) return null;
    return gameState.chosenColor || gameState.topCard?.color || null;
}

function getCardColorClass(card) {
    if (!card) return '';
    if (card.type === 'wild' || card.type === 'wild_draw_four') return 'wild';
    return card.color || '';
}

// ── Game State Handler ──────────────────────────────────
function handleGameState(state) {
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

    const opponents = gameState.playerCardCounts.filter(p => p.id !== myId);

    container.innerHTML = opponents.map(p => {
        const isCurrentTurn = gameState.currentPlayer && gameState.currentPlayer.id === p.id;
        const cardBacks = Array(Math.min(p.cardCount, 15)).fill(0)
            .map(() => `<div class="card-back-mini"></div>`).join('');

        return `
      <div class="opponent ${isCurrentTurn ? 'active-turn' : ''}">
        <span class="opponent-avatar">🎮</span>
        <span class="opponent-name">${p.username}</span>
        <div class="opponent-cards">${cardBacks}</div>
        <span style="font-size:0.75rem;color:var(--text-muted)">${p.cardCount} cards</span>
        ${p.cardCount === 1 ? '<span style="font-size:0.7rem;color:var(--uno-red);font-weight:700">UNO!</span>' : ''}
      </div>
    `;
    }).join('');
}

// ── Render Discard Pile ─────────────────────────────────
function renderDiscardPile() {
    if (!gameState || !gameState.topCard) return;
    const pile = document.getElementById('discard-pile');
    const card = gameState.topCard;
    const colorClass = gameState.chosenColor || getCardColorClass(card);

    pile.innerHTML = `
    <div class="discard-card ${colorClass}">
      <div class="card-value">${getCardSymbol(card)}</div>
      <div class="card-type">${getCardLabel(card)}</div>
    </div>
    ${gameState.chosenColor ? `<div class="color-indicator" style="background:var(--uno-${gameState.chosenColor})"></div>` : ''}
  `;

    // Update the active color banner
    renderActiveColorBanner();
}

// ── Active Color Banner (always visible) ────────────────
function renderActiveColorBanner() {
    let banner = document.getElementById('active-color-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'active-color-banner';
        banner.className = 'active-color-banner';
        // Insert after center-area or discard-pile
        const centerArea = document.querySelector('.center-area');
        if (centerArea) centerArea.after(banner);
        else document.querySelector('.game-board')?.appendChild(banner);
    }

    const color = getActiveColor();
    if (color) {
        const colorNames = { red: '🔴 RED', blue: '🔵 BLUE', green: '🟢 GREEN', yellow: '🟡 YELLOW' };
        const colorHex = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308' };
        banner.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${colorHex[color]};border:2px solid #fff;vertical-align:middle;margin-right:6px"></span> Active Color: <strong>${colorNames[color] || color.toUpperCase()}</strong>`;
        banner.style.background = `${colorHex[color]}22`;
        banner.style.borderColor = `${colorHex[color]}66`;
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

// ── Render Deck Count ───────────────────────────────────
function renderDeckCount() {
    if (!gameState) return;
    document.getElementById('deck-count').textContent = gameState.deckRemaining;
}

// ── Update Direction Indicator ──────────────────────────
function updateDirectionIndicator() {
    if (!gameState) return;
    const indicator = document.getElementById('direction-indicator');
    indicator.textContent = gameState.direction === 1 ? '↻' : '↺';
}

// ── Update Turn Indicator ───────────────────────────────
function updateTurnIndicator() {
    if (!gameState) return;
    const isMyTurn = gameState.currentPlayer && gameState.currentPlayer.id === currentUser?.id;
    const turnIndicator = document.getElementById('your-turn-indicator');
    const unoBtn = document.getElementById('uno-btn');

    if (isMyTurn) {
        turnIndicator.classList.remove('hidden');
    } else {
        turnIndicator.classList.add('hidden');
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
        const colorClass = getCardColorClass(card);
        const canPlay = isMyTurn && isCardPlayable(card);
        const selected = selectedCard === card.id ? 'selected' : '';
        // Always show unplayable state: dim cards that can't be played on your turn
        const playable = (isMyTurn && !canPlay) ? 'unplayable' : (!isMyTurn ? 'waiting' : '');

        return `
      <div class="uno-card ${colorClass} ${selected} ${playable} ${canPlay ? 'glow-playable' : ''}"
           data-card-id="${card.id}" 
           onclick="selectCard('${card.id}', ${i})"
           title="${card.color || 'wild'} ${card.type} ${card.value ?? ''}">
        <div class="card-value">${getCardSymbol(card)}</div>
        <div class="card-type">${getCardLabel(card)}</div>
      </div>
    `;
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
    if (!isMyTurn) return;

    const card = playerHand.find(c => c.id === cardId);
    if (!card) return;

    if (!isCardPlayable(card)) {
        showToast('Cannot play this card', 'error');
        return;
    }

    // If card already selected, play it
    if (selectedCard === cardId) {
        playSelectedCard(card);
        return;
    }

    selectedCard = cardId;
    renderHand(playerHand);
}

function playSelectedCard(card) {
    if (card.type === 'wild' || card.type === 'wild_draw_four') {
        pendingWildCard = card;
        document.getElementById('color-picker').classList.remove('hidden');
        return;
    }

    socket.emit('game:play', { cardId: card.id, chosenColor: null });
    selectedCard = null;
}

function chooseColor(color) {
    document.getElementById('color-picker').classList.add('hidden');
    if (pendingWildCard) {
        socket.emit('game:play', { cardId: pendingWildCard.id, chosenColor: color });
        pendingWildCard = null;
        selectedCard = null;
    }
}

// ── Draw Card ───────────────────────────────────────────
function drawCard() {
    const isMyTurn = gameState?.currentPlayer?.id === currentUser?.id;
    if (!isMyTurn) {
        showToast('Not your turn!', 'error');
        return;
    }
    socket.emit('game:draw');
    selectedCard = null;
}

// ── Call UNO ────────────────────────────────────────────
function callUno() {
    socket.emit('game:uno');
    showToast('UNO! 🎯', 'success');
}

// ── Turn Timer ──────────────────────────────────────────
function startTurnTimer() {
    clearInterval(turnTimerInterval);
    turnStartedAt = Date.now();

    turnTimerInterval = setInterval(() => {
        const elapsed = (Date.now() - turnStartedAt) / 1000;
        const remaining = Math.max(0, TURN_DURATION - elapsed);
        const pct = (remaining / TURN_DURATION) * 100;

        const fill = document.getElementById('timer-fill');
        const seconds = document.getElementById('timer-seconds');

        if (fill) {
            fill.style.width = pct + '%';
            fill.className = 'timer-fill' +
                (remaining < 5 ? ' danger' : remaining < 10 ? ' warning' : '');
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

    const winnerName = data.state?.playerCardCounts?.find(p => p.id === data.winner)?.username || 'Unknown';

    let html = `<p style="margin-bottom:16px;font-size:1.1rem;color:var(--text-secondary)">
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

// ── Floating Emoji ──────────────────────────────────────
function showFloatingEmoji(emoji) {
    const el = document.createElement('div');
    el.textContent = emoji;
    el.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    font-size: 3rem;
    z-index: 1000;
    pointer-events: none;
    animation: floatUp 1.5s ease forwards;
  `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// Add float animation
const floatStyle = document.createElement('style');
floatStyle.textContent = `
  @keyframes floatUp {
    0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
    50% { opacity: 1; transform: translate(-50%, -100%) scale(1.2); }
    100% { opacity: 0; transform: translate(-50%, -200%) scale(1); }
  }
`;
document.head.appendChild(floatStyle);
