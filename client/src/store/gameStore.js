import { create } from 'zustand';
import { io } from 'socket.io-client';

// In dev, Vite proxies /socket.io → localhost:3000
// In prod, same origin
const SOCKET_URL = import.meta.env.PROD ? '' : 'http://localhost:3000';

let socketInstance = null;

export const useGameStore = create((set, get) => ({
    socket: null,
    user: null,
    room: null,       // Room info (players list, code, state)
    gameState: null,  // Public game state (top card, turn, card counts)
    myHand: [],       // Private hand - only known to this player
    isConnected: false,
    error: null,
    toast: null,      // Temporary notification messages
    winner: null,
    scores: null,

    // ── Connection ───────────────────────────────────────
    connect: () => {
        if (socketInstance) {
            set({ socket: socketInstance });
            return;
        }

        const token = localStorage.getItem('uno_token');

        const socket = io(SOCKET_URL, {
            auth: { token: token || '' },
            transports: ['websocket', 'polling'],
        });
        socketInstance = socket;

        socket.on('connect', () => set({ isConnected: true, error: null }));
        socket.on('disconnect', () => set({ isConnected: false }));

        socket.on('auth:status', ({ user }) => {
            set({ user });
            if (user && !user.isGuest) {
                localStorage.setItem('uno_token', user.token || user.id);
            }
        });

        // Room state updates
        socket.on('room:state', (roomInfo) => set({ room: roomInfo }));
        socket.on('room:player_update', (roomInfo) => set({ room: roomInfo }));

        // Game state (public — all players see this)
        socket.on('game:state', (gameState) => {
            set((s) => ({
                gameState,
                // If game is over, track it
                winner: gameState.winner || s.winner,
                scores: gameState.scores || s.scores,
            }));
        });

        // Private hand — only sent to the owning player
        socket.on('game:hand', ({ hand }) => set({ myHand: hand }));

        // Toast events
        socket.on('game:card_played', ({ player, card, effect }) => {
            get()._toast(`${player} played ${card.type}${card.value !== null && card.value !== undefined ? ' ' + card.value : ''}`);
        });

        socket.on('game:uno_called', ({ player }) => {
            get()._toast(`🟨 UNO! — ${player}`);
        });

        socket.on('game:uno_challenged', ({ challenger, target, penaltyCards }) => {
            get()._toast(`⚠️ ${challenger} caught ${target} — draw 2!`);
        });

        socket.on('game:wd4_challenged', ({ challenger, result }) => {
            const msg = result.winner === 'challenger'
                ? `✅ ${challenger} challenged — bluff caught! ${result.penalized} draws ${result.count}`
                : `❌ Challenge failed! ${challenger} draws ${result.count}`;
            get()._toast(msg, 4000);
        });

        socket.on('game:wd4_accepted', ({ player, drawnCount }) => {
            get()._toast(`${player} accepted +4 and drew ${drawnCount} cards`);
        });

        socket.on('game:over', ({ winner, scores }) => {
            set({ winner, scores });
        });

        socket.on('game:error', ({ error }) => {
            set({ error });
            setTimeout(() => set({ error: null }), 3000);
        });

        // Room list broadcast
        socket.on('room:list', (list) => set({ rooms: list }));

        set({ socket });
    },

    // ── Helpers ──────────────────────────────────────────
    _toast: (message, duration = 2500) => {
        set({ toast: message });
        setTimeout(() => set({ toast: null }), duration);
    },

    // ── Room Actions ─────────────────────────────────────
    createRoom: () => get().socket?.emit('room:create'),
    createVsBotRoom: () => {
        const socket = get().socket;
        if (!socket) return;

        socket.emit('room:create');

        // Listen once for the next room:state to automatically add a bot
        socket.once('room:state', () => {
            setTimeout(() => {
                get().addBot('medium');
            }, 500); // Small delay to ensure server processed room entry
        });
    },
    joinRoom: (code) => get().socket?.emit('room:join', { code }),
    leaveRoom: () => {
        get().socket?.emit('room:leave');
        set({ room: null, gameState: null, myHand: [], winner: null, scores: null });
    },
    addBot: (difficulty) => get().socket?.emit('room:add_bot', { difficulty }),
    removeBot: (botId) => get().socket?.emit('room:remove_bot', { botId }),

    // ── Game Actions ─────────────────────────────────────
    startGame: () => get().socket?.emit('game:start'),
    playCard: (cardId, chosenColor) =>
        get().socket?.emit('game:play', { cardId, chosenColor }),
    drawCard: () => get().socket?.emit('game:draw'),
    callUno: () => get().socket?.emit('game:uno'),
    challengeUno: (targetId) =>
        get().socket?.emit('game:challenge_uno', { targetId }),
    challengeWd4: () => get().socket?.emit('game:challenge_wd4'),

    // ── Reset ────────────────────────────────────────────
    resetGame: () =>
        set({ gameState: null, myHand: [], winner: null, scores: null }),
}));
