import React, { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import Navbar from './components/Navbar';
import Lobby from './components/Lobby';
import Game from './components/Game';

export default function App() {
  const { gameState, connect } = useGameStore();

  useEffect(() => {
    connect();
  }, []);

  // Show game when game is actively being played 
  // (gameState exists AND either no .state field OR state is 'playing')
  const isPlaying = gameState && (gameState.state === 'playing' || !gameState.state || gameState.currentPlayer);

  return (
    <div className="min-h-screen text-white font-sans" style={{ background: '#050510' }}>
      {!isPlaying && <Navbar />}
      <main>
        {isPlaying ? <Game /> : <Lobby />}
      </main>
    </div>
  );
}
