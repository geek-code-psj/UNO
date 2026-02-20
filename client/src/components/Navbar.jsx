import React from 'react';

const Navbar = () => {
    return (
        <nav style={{ background: 'linear-gradient(135deg, #bd00ff, #3388ff)' }}
            className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 md:px-8 shadow-lg z-50"
        >
            {/* Logo */}
            <div className="flex items-center gap-2">
                <span className="text-2xl select-none">🂡</span>
                <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-wide">UNO Arena</h1>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/90">
                <a href="#" className="hover:text-white transition">Lobby</a>
                <a href="#" className="hover:text-white transition">Offline</a>
                <a href="#" className="hover:text-white transition">Rules</a>
                <a href="#" className="hover:text-white transition">Leaderboard</a>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
                <div className="bg-black/25 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1.5 text-white text-sm font-bold">
                    <span>🪙</span>
                    <span className="font-mono">100</span>
                </div>
                {/* Hamburger (mobile) */}
                <button className="md:hidden text-white p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
