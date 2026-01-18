'use client';

import { useEffect, useState } from 'react';
import { LobbyInfo, Player } from '@/lib/types';
import { useSocket } from './SocketProvider';

interface LobbyProps {
  lobby: LobbyInfo;
  players: Player[];
  currentPlayerId?: string;
}

export default function Lobby({ lobby, players, currentPlayerId }: LobbyProps) {
  const socket = useSocket();
  const [isHost, setIsHost] = useState(false);
  const [allReady, setAllReady] = useState(false);

  useEffect(() => {
    if (currentPlayerId) {
      setIsHost(lobby.hostId === currentPlayerId);
      
      if (isHost) {
        handleReady();
      }
      
    }
  }, [lobby.hostId, currentPlayerId]);

  useEffect(() => {
    setAllReady(
      players.length >= 2 && players.every((p) => p.ready || p.id === lobby.hostId)
    );
  }, [players, lobby.hostId]);

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

  return (
    <div className="lobby-container">
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

      <style jsx>{`
        .lobby-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem;
          background: var(--card-bg);
          border-radius: 8px;
          box-shadow: 0 2px 10px var(--shadow);
          transition: background-color 0.3s ease;
        }

        .lobby-header {
          text-align: center;
          margin-bottom: 2rem;
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
          margin-bottom: 0.75rem;
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

        .lobby-header p {
          margin: 0;
          color: var(--text-secondary);
        }

        .players-list {
          margin-bottom: 2rem;
        }

        .players-list h3 {
          margin-bottom: 1rem;
          color: var(--text-primary);
        }

        .player-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          margin-bottom: 0.5rem;
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
          border-radius: 4px;
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
        }

        .btn-start {
          background: var(--primary);
          color: white;
        }

        .btn-start:hover:not(:disabled) {
          background: var(--primary-hover);
        }

        .btn-start:disabled {
          background: var(--border);
          cursor: not-allowed;
          color: var(--text-tertiary);
        }

        .btn-leave {
          background: var(--danger);
          color: white;
        }

        .btn-leave:hover {
          background: var(--danger-hover);
        }
      `}</style>
    </div>
  );
}
