'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSocket } from '@/components/SocketProvider';
import { LobbyInfo, Player } from '@/lib/types';

export default function LobbyPage() {
  const socket = useSocket();
  const router = useRouter();
  const params = useParams();
  const lobbyId = params.lobbyId as string;

  const [lobby, setLobby] = useState<LobbyInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | undefined>();
  const [isHost, setIsHost] = useState(false);
  const [allReady, setAllReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Request lobby data on mount if we don't have it
    if (!lobby) {
      console.log('Requesting lobby data for:', lobbyId);
      socket.emit('lobby:get', lobbyId);
    }

    // Socket event handlers
    const handleLobbyJoined = (joinedLobby: LobbyInfo, joinedPlayers: Player[]) => {
      console.log('Lobby data received:', joinedLobby, joinedPlayers);
      setLobby(joinedLobby);
      setPlayers(joinedPlayers);
      
      // Find current player ID
      const myPlayer = joinedPlayers.find(p => p.socketId === socket.id);
      if (myPlayer) {
        setCurrentPlayerId(myPlayer.id);
        setIsHost(joinedLobby.hostId === myPlayer.id);
        
        // Auto-ready if host (only once)
        if (joinedLobby.hostId === myPlayer.id && !myPlayer.ready) {
          socket.emit('lobby:ready');
        }
      }
    };

    const handlePlayerUpdate = (updatedPlayers: Player[]) => {
      console.log('Player list updated:', updatedPlayers);
      setPlayers(updatedPlayers);
    };

    const handlePlayerJoined = (player: Player) => {
      setPlayers((prev) => [...prev, player]);
    };

    const handlePlayerLeft = (playerId: string) => {
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    };

    const handleLobbyLeft = () => {
      router.push('/');
    };

    const handleLobbyError = (message: string) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    };

    const handleGameStarted = () => {
      router.push(`/game/${lobbyId}`);
    };

    // Register event listeners
    socket.on('lobby:joined', handleLobbyJoined);
    socket.on('lobby:data', handleLobbyJoined); // Also listen for lobby:data response
    socket.on('lobby:players-updated', handlePlayerUpdate); // New event for player state changes
    socket.on('lobby:player-joined', handlePlayerJoined);
    socket.on('lobby:player-left', handlePlayerLeft);
    socket.on('lobby:left', handleLobbyLeft);
    socket.on('lobby:error', handleLobbyError);
    socket.on('game:started', handleGameStarted);

    return () => {
      socket.off('lobby:joined', handleLobbyJoined);
      socket.off('lobby:data', handleLobbyJoined);
      socket.off('lobby:players-updated', handlePlayerUpdate);
      socket.off('lobby:player-joined', handlePlayerJoined);
      socket.off('lobby:player-left', handlePlayerLeft);
      socket.off('lobby:left', handleLobbyLeft);
      socket.off('lobby:error', handleLobbyError);
      socket.off('game:started', handleGameStarted);
    };
  }, [socket, lobbyId, router]); // Removed 'lobby' from dependencies

  // Check if all players are ready
  useEffect(() => {
    if (lobby) {
      setAllReady(
        players.length >= 1 && players.every((p) => p.ready || p.id === lobby.hostId)
      );
    }
  }, [players, lobby]);

  const handleReady = () => {
    if (socket) {
      socket.emit('lobby:ready');
    }
  };

  const handleStart = () => {
    if (socket && isHost) {
      socket.emit('lobby:start');
    }
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit('lobby:leave');
    }
  };

  if (!socket) {
    return (
      <div className="loading">
        <p>Connecting to server...</p>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="loading">
        <p>Loading lobby...</p>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      {error && <div className="error-banner">{error}</div>}

      <div className="lobby-card">
        <div className="lobby-header">
          <h2>{lobby.name}</h2>
          <div className="lobby-meta">
            <span className="meta-item">
              👥 {players.length} / {lobby.maxPlayers} Players
            </span>
            <span className="meta-item difficulty">
              {lobby.difficulty.charAt(0).toUpperCase() + lobby.difficulty.slice(1)}
            </span>
          </div>
          {lobby.theme && (
            <p className="lobby-theme">
              <strong>Theme:</strong> {lobby.theme}
            </p>
          )}
        </div>

        <div className="players-list">
          <h3>Players</h3>
          {players.map((player) => (
            <div key={player.id} className="player-item">
              <span className="player-name">
                {player.nickname}
                {player.id === lobby.hostId && ' 👑'}
                {player.id === currentPlayerId && ' (You)'}
              </span>
              <span className="player-status">
                {player.ready || player.id === lobby.hostId ? '✓ Ready' : 'Not Ready'}
              </span>
            </div>
          ))}
        </div>

        <div className="lobby-actions">
          {!isHost && (
            <button onClick={handleReady} className="btn-ready">
              Ready
            </button>
          )}
          {isHost && (
            <button
              onClick={handleStart}
              disabled={!allReady}
              className="btn-start"
            >
              Start Game
            </button>
          )}
          <button onClick={handleLeave} className="btn-leave">
            Leave Lobby
          </button>
        </div>
      </div>

      <style jsx>{`
        .lobby-container {
          min-height: 100vh;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: var(--bg-primary);
        }

        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-size: 1.2rem;
          color: var(--text-primary);
        }

        .error-banner {
          background: var(--danger);
          color: white;
          padding: 1rem;
          border-radius: 4px;
          margin-bottom: 1.2rem;
          text-align: center;
          max-width: 600px;
        }

        .lobby-card {
          max-width: 600px;
          width: 100%;
          background: var(--card-bg);
          border-radius: 12px;
          box-shadow: 0 4px 20px var(--shadow);
          padding: 2rem;
          transition: background-color 0.3s ease;
        }

        .lobby-header {
          text-align: center;
          margin-bottom: 1.6rem;
          border-bottom: 2px solid var(--border);
          padding-bottom: 1rem;
        }

        .lobby-header h2 {
          margin: 0 0 1rem 0;
          color: var(--text-primary);
          font-size: 1.8rem;
        }

        .lobby-meta {
          display: flex;
          justify-content: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 0.6rem;
        }

        .meta-item {
          padding: 0.4rem 0.8rem;
          background: var(--bg-secondary);
          border-radius: 4px;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .meta-item.difficulty {
          background: var(--primary);
          color: white;
          font-weight: 600;
        }

        .lobby-theme {
          margin: 0;
          padding: 0.5rem;
          background: var(--card-hover);
          border-radius: 4px;
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-style: italic;
        }

        .lobby-theme strong {
          color: var(--text-primary);
          font-style: normal;
        }

        .players-list {
          margin-bottom: 1.6rem;
        }

        .players-list h3 {
          margin-bottom: 0.8rem;
          color: var(--text-primary);
        }

        .player-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          margin-bottom: 0.4rem;
          background: var(--card-hover);
          border-radius: 4px;
          border: 1px solid var(--border);
        }

        .player-name {
          font-weight: 600;
          color: var(--text-primary);
        }

        .player-status {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .lobby-actions {
          display: flex;
          gap: 1rem;
        }

        button {
          flex: 1;
          padding: 1rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-ready {
          background: var(--success);
          color: white;
        }

        .btn-ready:hover {
          background: var(--success-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--shadow-hover);
        }

        .btn-start {
          background: var(--primary);
          color: white;
        }

        .btn-start:hover:not(:disabled) {
          background: var(--primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--shadow-hover);
        }

        .btn-start:disabled {
          background: var(--border);
          cursor: not-allowed;
          color: var(--text-tertiary);
          opacity: 0.6;
        }

        .btn-leave {
          background: var(--danger);
          color: white;
        }

        .btn-leave:hover {
          background: var(--danger-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--shadow-hover);
        }

        @media (max-width: 768px) {
          .lobby-container {
            padding: 0;
            justify-content: flex-start;
          }

          .lobby-card {
            max-width: 100%;
            border-radius: 0;
            box-shadow: none;
            padding: 1.5rem 1rem;
            min-height: 100vh;
          }

          .lobby-header {
            padding-bottom: 1rem;
            margin-bottom: 0.9rem;
          }

          .lobby-header h2 {
            font-size: 1.5rem;
          }

          .info-grid {
            gap: 0.75rem;
          }

          .players-list {
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
