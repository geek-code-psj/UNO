// public/js/app.js — Lobby & Socket.IO connection

let socket = null;
let currentRoomCode = null;
let isHost = false;

function connectSocket() {
    if (socket && socket.connected) return;

    socket = io({
        auth: { token: currentToken },
    });
    window.socket = socket;

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('auth:status', (data) => {
        if (!currentUser && data.user) {
            // Guest user info from server
            currentUser = data.user;
            updateUserUI();
        }
    });

    // Room list
    socket.on('room:list', (rooms) => {
        renderRoomList(rooms);
    });

    // Room state update
    socket.on('room:state', (info) => {
        currentRoomCode = info.code;
        showWaitingRoom(info);
    });

    // Player update in room
    socket.on('room:player_update', (info) => {
        if (currentRoomCode === info.code) {
            showWaitingRoom(info);
        }
    });

    // Game start
    socket.on('game:state', (state) => {
        handleGameState(state);
    });

    // Hand update (private)
    socket.on('game:hand', (data) => {
        renderHand(data.hand);
    });

    // Card played
    socket.on('game:card_played', (data) => {
        showToast(`${data.player} played a card`, 'info');
    });

    // UNO called
    socket.on('game:uno_called', (data) => {
        showToast(`${data.player} called UNO! 🎯`, 'info');
    });

    // UNO challenged
    socket.on('game:uno_challenged', (data) => {
        showToast(`${data.challenger} challenged! Target draws ${data.penaltyCards} cards`, 'info');
    });

    // Turn timeout
    socket.on('game:timeout', (data) => {
        showToast(`${data.player.username} timed out — auto-drew a card`, 'info');
    });

    // Game over
    socket.on('game:over', (data) => {
        handleGameOver(data);
    });

    // Chat messages
    socket.on('chat:message', (msg) => {
        addChatMessage(msg);
    });

    // Emoji reaction
    socket.on('chat:emoji', (data) => {
        showFloatingEmoji(data.emoji);
    });

    // Errors
    socket.on('game:error', (data) => {
        showToast(data.error, 'error');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected');
    });
}

// ── Room Management ─────────────────────────────────────
function createRoom() {
    if (!socket) return showToast('Not connected', 'error');
    socket.emit('room:create', { maxPlayers: 4 });
    isHost = true;
}

function createBotGame() {
    if (!socket) return showToast('Not connected', 'error');
    socket.emit('room:create', { maxPlayers: 4 });
    isHost = true;
    // Wait for room to be created then add a bot
    socket.once('room:state', () => {
        setTimeout(() => {
            socket.emit('room:add_bot', { difficulty: 'medium' });
        }, 300);
    });
}

function addBot(difficulty) {
    if (!socket) return showToast('Not connected', 'error');
    socket.emit('room:add_bot', { difficulty: difficulty || 'medium' });
}

function removeBot(botId) {
    if (!socket) return showToast('Not connected', 'error');
    socket.emit('room:remove_bot', { botId });
}

function joinRoomByCode() {
    if (!socket) return showToast('Not connected', 'error');
    const code = document.getElementById('join-code-input').value.trim().toUpperCase();
    if (!code) return showToast('Enter a room code', 'error');
    socket.emit('room:join', { code });
    isHost = false;
}

function joinRoom(code) {
    if (!socket) return showToast('Not connected', 'error');
    socket.emit('room:join', { code });
    isHost = false;
}

function leaveRoom() {
    if (socket) socket.emit('room:leave');
    currentRoomCode = null;
    isHost = false;
    showLobby();
}

function startGame() {
    if (socket) socket.emit('game:start');
}

// ── UI Rendering ────────────────────────────────────────
function renderRoomList(rooms) {
    const container = document.getElementById('room-list');
    if (rooms.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">
      No rooms available. Create one to start playing!
    </div>`;
        return;
    }

    container.innerHTML = rooms.map(room => `
    <div class="room-card" onclick="joinRoom('${room.code}')">
      <div class="room-info">
        <h4>Room ${room.code}</h4>
        <span>Waiting for players</span>
      </div>
      <div class="room-players">
        <span class="count">${room.playerCount}</span>/<span>${room.maxPlayers}</span> 👥
      </div>
    </div>
  `).join('');
}

function showWaitingRoom(info) {
    document.getElementById('lobby-page').classList.add('hidden');
    document.getElementById('game-page').classList.add('hidden');
    document.getElementById('waiting-room-page').classList.remove('hidden');

    document.getElementById('waiting-room-code').textContent = info.code;

    const playersContainer = document.getElementById('waiting-players');
    playersContainer.innerHTML = info.players.map((p, i) => {
        const isBot = p.isBot || (p.username && p.username.startsWith('🤖'));
        return `
    <div class="waiting-player ${i === 0 ? 'host' : ''}">
      <span class="wp-avatar">${i === 0 ? '👑' : isBot ? '🤖' : '🎮'}</span>
      <span class="wp-name">${p.username}</span>
      ${isBot && isHost ? `<button class="btn btn-sm btn-danger" style="padding:2px 8px;font-size:0.7rem" onclick="removeBot('${p.id}')">✕</button>` : ''}
    </div>
  `;
    }).join('');

    // Show bot controls for the host
    const botControls = document.getElementById('bot-controls');
    if (isHost && info.players.length < (info.maxPlayers || 4)) {
        botControls.classList.remove('hidden');
        botControls.style.display = 'flex';
    } else {
        botControls.classList.add('hidden');
    }

    // Show start button only for host with 2+ players
    const startBtn = document.getElementById('start-game-btn');
    if (isHost && info.players.length >= 2) {
        startBtn.classList.remove('hidden');
    } else {
        startBtn.classList.add('hidden');
    }
}

function showLobby() {
    document.getElementById('lobby-page').classList.remove('hidden');
    document.getElementById('waiting-room-page').classList.add('hidden');
    document.getElementById('game-page').classList.add('hidden');
    document.getElementById('gameover-modal').classList.add('hidden');
}

function backToLobby() {
    leaveRoom();
    loadProfile();
}
