import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';

const Navbar = () => {
    const { user, leaveRoom, room } = useGameStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav
            style={{
                background: 'linear-gradient(135deg, #bd00ff, #3388ff)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
            className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 md:px-8 z-[100]"
        >
            {/* Logo */}
            <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => {
                    if (room) {
                        if (window.confirm('Leave current room and return to lobby?')) {
                            leaveRoom();
                        }
                    } else {
                        window.location.reload();
                    }
                }}
            >
                <span className="text-2xl select-none animate-pulse">🂡</span>
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter">UNO ARENA</h1>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-8 text-sm font-bold text-white/90">
                <button onClick={() => window.location.reload()} className="hover:text-white hover:scale-105 transition">LOBBY</button>
                <button onClick={() => alert('Offline mode coming soon!')} className="hover:text-white hover:scale-105 transition">OFFLINE</button>
                <button onClick={() => alert('Rules: Match color or number. +2, Skip, Reverse, Wild, and +4. Call UNO on 1 card!')} className="hover:text-white hover:scale-105 transition">RULES</button>
                <button onClick={() => alert('Leaderboard features coming in the next update!')} className="hover:text-white hover:scale-105 transition">LEADERBOARD</button>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
                <div className="bg-black/30 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-2 text-white border border-white/10">
                    <span className="text-yellow-400 drop-shadow-sm">🪙</span>
                    <span className="font-black font-mono tracking-tight">{user?.coins || 0}</span>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="md:hidden text-white p-1 hover:bg-white/10 rounded-lg transition"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                    </svg>
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="absolute top-16 left-0 right-0 bg-bg-secondary/95 backdrop-blur-xl border-b border-white/10 py-6 px-4 flex flex-col gap-4 md:hidden shadow-2xl animate-in fade-in slide-in-from-top-4">
                    <button onClick={() => { setIsMenuOpen(false); window.location.reload(); }} className="text-left font-bold text-lg p-2 hover:bg-white/5 rounded-lg transition">Lobby</button>
                    <button onClick={() => { setIsMenuOpen(false); alert('Offline mode coming soon!'); }} className="text-left font-bold text-lg p-2 hover:bg-white/5 rounded-lg transition">Offline</button>
                    <button onClick={() => { setIsMenuOpen(false); alert('Rules: Match color or number. +2, Skip, Reverse, Wild, and +4. Call UNO on 1 card!'); }} className="text-left font-bold text-lg p-2 hover:bg-white/5 rounded-lg transition">Rules</button>
                    <button onClick={() => { setIsMenuOpen(false); alert('Leaderboard features coming soon!'); }} className="text-left font-bold text-lg p-2 hover:bg-white/5 rounded-lg transition">Leaderboard</button>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
