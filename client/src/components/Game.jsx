import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

// ── Helpers ────────────────────────────────────────────────
const COLOR_BG = {
    red: 'from-red-500 to-red-700',
    blue: 'from-blue-500 to-blue-700',
    green: 'from-green-400 to-green-600',
    yellow: 'from-yellow-400 to-yellow-600',
};

const COLOR_TEXT = {
    red: 'text-red-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
};

const canPlay = (card, topCard, activeColor) => {
    if (!card || !topCard) return false;
    if (card.type === 'wild' || card.type === 'wild_draw_four') return true;
    if (card.color === activeColor) return true;
    if (card.type === topCard.type && card.type !== 'number') return true;
    if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;
    return false;
};

// ── Card Component ─────────────────────────────────────────
function UnoCard({ card, onClick, dimmed = false, className = '' }) {
    if (!card) return null;
    const isWild = card.type === 'wild' || card.type === 'wild_draw_four';

    const symbol = () => {
        if (card.type === 'number') return card.value;
        if (card.type === 'skip') return '⊘';
        if (card.type === 'reverse') return '⇄';
        if (card.type === 'draw_two') return '+2';
        if (card.type === 'wild') return '🌈';
        if (card.type === 'wild_draw_four') return '+4';
        return '?';
    };

    const bgClass = isWild
        ? 'bg-gradient-to-br from-red-500 via-blue-500 to-green-400'
        : `bg-gradient-to-br ${COLOR_BG[card.color] || 'from-gray-500 to-gray-700'}`;

    return (
        <div
            onClick={onClick}
            className={`
                relative w-[60px] h-[90px] sm:w-20 sm:h-28 md:w-24 md:h-36
                ${bgClass} rounded-xl border-[3px] border-white shadow-lg
                flex items-center justify-center select-none
                ${dimmed ? 'brightness-50' : 'brightness-100'}
                ${onClick ? 'cursor-pointer hover:-translate-y-4 active:translate-y-0 transition-transform duration-150' : ''}
                ${className}
            `}
        >
            {/* Corner numbers */}
            <span className="absolute top-1 left-1.5 text-white font-black text-xs leading-none drop-shadow">{symbol()}</span>
            <span className="absolute bottom-1 right-1.5 text-white font-black text-xs leading-none drop-shadow rotate-180">{symbol()}</span>

            {/* Center oval */}
            <div className="w-[75%] h-[55%] bg-white/85 rounded-full -rotate-[25deg] flex items-center justify-center shadow-inner">
                <span className={`text-xl sm:text-2xl md:text-3xl font-black rotate-[25deg] ${isWild ? 'text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-400 to-blue-500' : (card.color ? COLOR_TEXT[card.color] : 'text-black')}`}>
                    {symbol()}
                </span>
            </div>
        </div>
    );
}

// ── Back-face card (for opponents) ────────────────────────
function CardBack({ className = '' }) {
    return (
        <div className={`w-8 h-12 sm:w-10 sm:h-14 bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-white/10 rounded-lg shadow flex items-center justify-center ${className}`}>
            <span className="text-[8px] font-black text-white/30 rotate-45">UNO</span>
        </div>
    );
}

// ── Game Over Screen ────────────────────────────────────────
function GameOverScreen({ winner, scores, players, onLeave }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
            <div className="glass rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border border-white/10">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-3xl font-black mb-2">Game Over!</h2>
                <p className="text-xl text-yellow-300 font-bold mb-6">{winner?.username || 'Someone'} wins!</p>

                {/* Scores */}
                <div className="space-y-2 mb-8">
                    {players?.filter(p => scores?.[p.id] !== undefined).sort((a, b) => {
                        // Winner (highest collector score) first? Actually winner gets sum, others have hand value
                        if (a.id === winner?.id) return -1;
                        if (b.id === winner?.id) return 1;
                        return (scores[a.id] || 0) - (scores[b.id] || 0);
                    }).map(p => (
                        <div key={p.id} className={`flex justify-between items-center px-4 py-2 rounded-lg ${p.id === winner?.id ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-black/20'}`}>
                            <span className="font-medium">{p.id === winner?.id ? '🥇 ' : ''}{p.username}</span>
                            <span className="font-mono font-bold">{scores?.[p.id] ?? 0} pts</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={onLeave}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 py-3 rounded-xl font-bold text-lg hover:scale-105 active:scale-95 transition"
                >
                    Back to Lobby
                </button>
            </div>
        </motion.div>
    );
}

// ── Main Game Component ────────────────────────────────────
export default function Game() {
    const { gameState, myHand, user, winner, scores, playCard, drawCard, callUno, challengeWd4, leaveRoom, toast, error } = useGameStore();
    const [pendingWildCard, setPendingWildCard] = useState(null);

    if (!gameState) return (
        <div className="flex h-[calc(100vh-4rem)] mt-16 items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-t-blue-400 animate-spin" />
        </div>
    );

    const myId = user?.id;
    const isMyTurn = gameState.currentPlayer?.id === myId;
    const activeColor = gameState.chosenColor || gameState.topCard?.color;
    const isPendingWD4Target = gameState.pendingAction?.targetPlayerId === myId;
    const opponents = gameState.playerCardCounts?.filter(p => p.id !== myId) || [];

    const handleCardClick = (card) => {
        if (!isMyTurn || isPendingWD4Target) return;
        if (!canPlay(card, gameState.topCard, activeColor)) return;

        if (card.type === 'wild' || card.type === 'wild_draw_four') {
            setPendingWildCard(card);
        } else {
            playCard(card.id, null);
        }
    };

    const handleColorSelect = (color) => {
        if (pendingWildCard) {
            playCard(pendingWildCard.id, color);
            setPendingWildCard(null);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">

            {/* ── GAME OVER OVERLAY ── */}
            <AnimatePresence>
                {(winner || gameState.winner) && (
                    <GameOverScreen
                        winner={gameState.players?.find(p => p.id === (winner || gameState.winner))}
                        scores={scores || gameState.scores}
                        players={gameState.players}
                        onLeave={leaveRoom}
                    />
                )}
            </AnimatePresence>

            {/* ── OPPONENTS (Top) ── */}
            <div className="flex-none pt-20 pb-4 px-4 flex justify-center gap-6 flex-wrap">
                {opponents.map(p => {
                    const isCurrent = gameState.currentPlayer?.id === p.id;
                    const canBeChallenged = p.cardCount === 1; // Simplification: assume they didn't call if they have 1 card

                    return (
                        <div key={p.id} className={`flex flex-col items-center gap-1 transition-all duration-300 ${isCurrent ? 'scale-110' : ''}`}>
                            <div className="relative">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-lg bg-black/40 border-2 ${isCurrent ? 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.5)] animate-pulse' : 'border-white/10'}`}>
                                    {p.isBot ? '🤖' : p.username?.[0]?.toUpperCase()}
                                </div>
                                {canBeChallenged && (
                                    <button
                                        onClick={() => challengeUno(p.id)}
                                        className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-white/20 shadow-lg animate-bounce"
                                        title="Challenge UNO!"
                                    >
                                        ⚔️
                                    </button>
                                )}
                            </div>
                            <span className="text-xs font-medium text-gray-300 max-w-[80px] truncate">{p.username}</span>
                            <div className="flex -space-x-2">
                                {Array.from({ length: Math.min(p.cardCount, 7) }).map((_, i) => (
                                    <CardBack key={i} />
                                ))}
                            </div>
                            <span className="text-[10px] text-gray-500">{p.cardCount} left</span>
                        </div>
                    );
                })}
            </div>

            {/* ── CENTER FIELD ── */}
            <div className="flex-1 flex flex-col items-center justify-center relative gap-6">

                {/* Active Color Indicator */}
                {activeColor && (
                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${activeColor === 'red' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                        activeColor === 'blue' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                            activeColor === 'green' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                                'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                        }`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${activeColor === 'red' ? 'bg-red-500' :
                            activeColor === 'blue' ? 'bg-blue-500' :
                                activeColor === 'green' ? 'bg-green-500' : 'bg-yellow-500'
                            }`} />
                        Active: {activeColor}
                    </div>
                )}

                {/* Turn Indicator */}
                {isMyTurn && !isPendingWD4Target && (
                    <div className="absolute top-0 text-xs font-bold bg-green-500 text-black px-4 py-1 rounded-b-full animate-bounce shadow-lg">
                        YOUR TURN
                    </div>
                )}

                {/* Piles */}
                <div className="flex items-center gap-8 md:gap-16">
                    {/* Draw Pile */}
                    <div
                        onClick={() => isMyTurn && !isPendingWD4Target && drawCard()}
                        className={`relative w-24 h-36 md:w-28 md:h-40 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-2 border-white/10 flex items-center justify-center shadow-2xl transition-all ${isMyTurn && !isPendingWD4Target ? 'cursor-pointer hover:-translate-y-2 hover:shadow-blue-500/20 hover:border-blue-400/50' : 'cursor-default'}`}
                    >
                        <div className="absolute inset-2 border border-dashed border-white/10 rounded-lg" />
                        <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 -rotate-12">UNO</span>
                        <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] font-bold w-7 h-7 rounded-full flex items-center justify-center shadow">
                            {gameState.deckRemaining}
                        </div>
                    </div>

                    {/* Discard Pile */}
                    <div className="relative w-24 h-36 md:w-28 md:h-40">
                        <div className="absolute inset-0 rounded-xl rotate-6 bg-white/5" />
                        <div className="absolute inset-0 rounded-xl -rotate-3 bg-white/5" />
                        {gameState.topCard && (
                            <UnoCard card={gameState.topCard} className="absolute inset-0 !w-full !h-full" />
                        )}
                    </div>
                </div>

                {/* Direction */}
                <div className="text-xs text-gray-600 flex items-center gap-2">
                    <span>{gameState.direction === 1 ? '→' : '←'}</span>
                    <span>{gameState.direction === 1 ? 'Clockwise' : 'Counter-clockwise'}</span>
                </div>
            </div>

            {/* ── WILD DRAW 4 CHALLENGE PANEL ── */}
            <AnimatePresence>
                {isPendingWD4Target && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="absolute bottom-40 left-1/2 -translate-x-1/2 z-30 w-[320px] glass border border-red-500/40 rounded-2xl p-5 shadow-2xl shadow-red-900/40"
                    >
                        <h3 className="text-center font-bold text-red-400 mb-1">Wild Draw Four Played!</h3>
                        <p className="text-center text-xs text-gray-400 mb-4">Challenge if you think they bluffed (had a matching color)</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={drawCard}
                                className="bg-white/10 hover:bg-white/20 py-2.5 rounded-lg text-sm font-bold transition"
                            >
                                Accept (+4)
                            </button>
                            <button
                                onClick={challengeWd4}
                                className="bg-gradient-to-r from-red-600 to-red-800 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-red-500/30 hover:scale-105 transition"
                            >
                                ⚔️ Challenge!
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── MY HAND ── */}
            <div className="flex-none pb-6 px-4 relative">
                {/* UNO Button */}
                {myHand.length <= 2 && myHand.length > 0 && (
                    <button
                        onClick={callUno}
                        className="absolute -top-12 right-6 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black italic text-xl px-6 py-2 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.5)] hover:scale-110 active:scale-95 transition z-10"
                    >
                        UNO!
                    </button>
                )}

                {/* Hand */}
                <div className="flex justify-center items-end overflow-x-auto pb-1">
                    <div className="flex -space-x-6 sm:-space-x-8 md:-space-x-10 hover:-space-x-2 transition-all duration-300 items-end">
                        {myHand.map((card, i) => {
                            const playable = isMyTurn && !isPendingWD4Target && canPlay(card, gameState.topCard, activeColor);
                            return (
                                <motion.div
                                    key={card.id}
                                    initial={{ y: 60, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="origin-bottom"
                                >
                                    <UnoCard
                                        card={card}
                                        onClick={playable ? () => handleCardClick(card) : undefined}
                                        dimmed={isMyTurn && !playable && !isPendingWD4Target}
                                    />
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── COLOR PICKER MODAL ── */}
            <AnimatePresence>
                {pendingWildCard && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
                        onClick={() => setPendingWildCard(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.7 }}
                            animate={{ scale: 1 }}
                            className="grid grid-cols-2 gap-4 p-8 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <p className="col-span-2 text-center font-bold text-gray-300 mb-1">Choose a color</p>
                            {['red', 'blue', 'green', 'yellow'].map(color => (
                                <button
                                    key={color}
                                    onClick={() => handleColorSelect(color)}
                                    className={`w-24 h-24 rounded-xl bg-gradient-to-br ${COLOR_BG[color]} shadow-lg hover:scale-110 active:scale-95 transition-all`}
                                />
                            ))}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast */}
            <AnimatePresence>
                {(toast || error) && (
                    <motion.div
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 40, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur text-white px-6 py-3 rounded-full shadow-xl text-sm z-40"
                    >
                        {toast || error}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
