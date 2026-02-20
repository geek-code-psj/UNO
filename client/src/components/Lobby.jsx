import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export default function Lobby() {
    const {
        user, isConnected, connect, createRoom, joinRoom, addBot,
        removeBot, startGame, leaveRoom, room, error, toast
    } = useGameStore();
    const [roomCode, setRoomCode] = useState('');
    const [codeInput, setCodeInput] = useState('');

    useEffect(() => {
        connect();
    }, []); // connect is stable (singleton socket)

    // ── Loading ───────────────────────────────────────────
    if (!isConnected) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-transparent border-t-blue-400 animate-spin" />
                    <p className="text-gray-400 text-sm">Connecting to server…</p>
                </div>
            </div>
        );
    }

    // ── Waiting Room (after create/join) ──────────────────
    if (room) {
        const isHost = room.players?.[0]?.id === user?.id;
        const humanPlayers = room.players?.filter(p => !p.isBot) || [];
        const bots = room.players?.filter(p => p.isBot) || [];
        const canStart = room.players?.length >= 2;

        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] mt-16 px-4">
                <div className="glass p-8 rounded-2xl w-full max-w-lg">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">🎴 Waiting Room</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Room Code:</span>
                            <code className="bg-black/40 px-3 py-1 rounded font-mono text-lg font-bold text-uno-green tracking-widest">
                                {room.code}
                            </code>
                        </div>
                    </div>

                    {/* Player List */}
                    <div className="space-y-2 mb-6">
                        {room.players?.map((p, i) => (
                            <div key={p.id} className="flex items-center justify-between bg-black/20 rounded-lg px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-purple flex items-center justify-center text-sm font-bold">
                                        {p.isBot ? '🤖' : p.username[0].toUpperCase()}
                                    </div>
                                    <span className="font-medium">{p.username}</span>
                                    {i === 0 && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Host</span>}
                                    {p.isBot && <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Bot</span>}
                                </div>
                                {isHost && p.isBot && (
                                    <button
                                        onClick={() => removeBot(p.id)}
                                        className="text-red-400 hover:text-red-300 text-xs transition"
                                    >
                                        ✕ Remove
                                    </button>
                                )}
                            </div>
                        ))}
                        {/* Empty slots */}
                        {Array.from({ length: Math.max(0, (room.maxPlayers || 4) - (room.players?.length || 0)) }).map((_, i) => (
                            <div key={`empty-${i}`} className="flex items-center gap-3 bg-black/10 border border-dashed border-white/10 rounded-lg px-4 py-3 text-gray-600">
                                <div className="w-8 h-8 rounded-full border-2 border-dashed border-white/20" />
                                <span className="text-sm">Waiting for player…</span>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    {isHost && (
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {['easy', 'medium', 'hard'].map(diff => (
                                <button
                                    key={diff}
                                    onClick={() => addBot(diff)}
                                    disabled={room.players?.length >= (room.maxPlayers || 4)}
                                    className="bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed py-2 rounded-lg text-sm font-medium transition"
                                >
                                    + {diff.charAt(0).toUpperCase() + diff.slice(1)} Bot
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={leaveRoom}
                            className="flex-none bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 rounded-xl transition text-sm"
                        >
                            ← Leave
                        </button>
                        {isHost && (
                            <button
                                onClick={startGame}
                                disabled={!canStart}
                                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed py-3 rounded-xl font-bold text-lg shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition"
                            >
                                {canStart ? '▶ Start Game' : `Need ${2 - (room.players?.length || 0)} more player(s)`}
                            </button>
                        )}
                        {!isHost && (
                            <div className="flex-1 bg-black/20 py-3 rounded-xl text-center text-gray-400 text-sm">
                                Waiting for host to start…
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Lobby ────────────────────────────────────────
    return (
        <div className="container max-w-6xl mx-auto px-4 py-8 mt-16">

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-extrabold mb-1">
                    Welcome back, <span className="text-transparent bg-clip-text bg-gradient-purple">{user?.username}</span> 👋
                </h1>
                <p className="text-gray-400 text-sm">Create a game, join a friend, or play against AI</p>
            </div>

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl mb-12">
                <button
                    id="create-room-btn"
                    onClick={createRoom}
                    className="flex flex-col items-center justify-center gap-2 p-5 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-1 active:translate-y-0 transition-all"
                >
                    <span className="text-3xl">✨</span>
                    <span className="font-bold text-sm">Create Room</span>
                </button>

                <button
                    id="vs-bot-btn"
                    onClick={() => {
                        createRoom();
                        // Room creation is async via socket; bot will be added once room state arrives
                        // We listen via room state — a separate useEffect or the user can add bot in the waiting room
                    }}
                    className="flex flex-col items-center justify-center gap-2 p-5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-1 active:translate-y-0 transition-all"
                >
                    <span className="text-3xl">🤖</span>
                    <span className="font-bold text-sm">VS Bot</span>
                </button>

                {/* Join Code — spans 2 cols */}
                <div className="col-span-2 glass rounded-xl p-4 flex flex-col gap-2">
                    <input
                        id="room-code-input"
                        type="text"
                        placeholder="ENTER CODE"
                        maxLength={8}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-center uppercase tracking-widest font-mono font-bold focus:border-uno-green focus:outline-none transition"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && joinRoom(codeInput)}
                    />
                    <button
                        id="join-room-btn"
                        onClick={() => joinRoom(codeInput)}
                        disabled={codeInput.length < 4}
                        className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed py-2 rounded-lg font-semibold transition text-sm"
                    >
                        Join Room →
                    </button>
                </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Rooms / placeholder */}
                <div className="lg:col-span-2">
                    <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">Public Rooms</h3>
                    <div className="glass rounded-xl p-10 text-center border-dashed border-2 border-white/10">
                        <p className="text-gray-500">No public rooms right now</p>
                        <p className="text-gray-600 text-sm mt-1">Create one to invite friends!</p>
                    </div>
                </div>

                {/* Right: Profile + Rules */}
                <div className="space-y-5">
                    {/* Stats */}
                    <div className="glass p-5 rounded-xl">
                        <h3 className="font-bold mb-4">📊 Your Stats</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Wins', value: user?.wins ?? 0, color: 'text-uno-green' },
                                { label: 'Losses', value: user?.losses ?? 0, color: 'text-uno-red' },
                                { label: 'Win Rate', value: `${user?.wins && user?.games_played ? Math.round((user.wins / user.games_played) * 100) : 0}%`, color: 'text-uno-blue' },
                                { label: 'Coins', value: user?.coins ?? 0, color: 'text-uno-yellow' },
                            ].map(s => (
                                <div key={s.label} className="bg-black/20 p-3 rounded-lg text-center">
                                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Rules */}
                    <div className="glass p-5 rounded-xl">
                        <h3 className="font-bold mb-3">🃏 Quick Rules</h3>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li>🔵 Match by <strong className="text-white">color</strong> or <strong className="text-white">number</strong></li>
                            <li>🚫 Skip, ⇄ Reverse, +2 Draw Two</li>
                            <li>🌈 Wild — choose any color</li>
                            <li>+4 Wild Draw Four — challenge bluffs!</li>
                            <li>📢 Call UNO with 1 card or draw 2!</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Error toast */}
            {error && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur text-white px-6 py-3 rounded-full shadow-xl text-sm font-medium z-50">
                    ⚠️ {error}
                </div>
            )}
            {toast && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur text-white px-6 py-3 rounded-full shadow-xl text-sm z-50">
                    {toast}
                </div>
            )}
        </div>
    );
}
