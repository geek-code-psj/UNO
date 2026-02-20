import React, { useEffect } from 'react';
import Navbar from './components/Navbar';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { useGameStore } from './store/gameStore';

export default function App() {
  const { gameState, room, connect } = useGameStore();

  useEffect(() => {
    connect();
  }, []); // Initialize socket once on mount

  // Show game only when an active game is in progress
  const showGame = gameState && gameState.state === 'playing';

  return (
    <div className="min-h-screen bg-bg-primary text-white font-sans">
      {!showGame && <Navbar />}
      <main>
        {showGame ? <Game /> : <Lobby />}
      </main>
    </div>
  );
}
