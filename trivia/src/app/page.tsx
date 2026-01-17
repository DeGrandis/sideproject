'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/components/SocketProvider';
import Lobby from '@/components/Lobby';
import Game from '@/components/Game';
import { LobbyInfo, Player, GameState } from '@/lib/types';

type ViewState = 'home' | 'lobby' | 'game';

export default function HomePage() {
  const socket = useSocket();
  const [viewState, setViewState] = useState<ViewState>('home');
  const [nickname, setNickname] = useState('');
  const [availableLobbies, setAvailableLobbies] = useState<LobbyInfo[]>([]);
  const [currentLobby, setCurrentLobby] = useState<LobbyInfo | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | undefined>();
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [joinLobbyId, setJoinLobbyId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Request initial lobby list
    socket.emit('lobby:list');

    socket.on('lobby:updated', (lobbies) => {
      setAvailableLobbies(lobbies);
    });

    socket.on('lobby:joined', (lobby, players) => {
      setCurrentLobby(lobby);
      setLobbyPlayers(players);
      setViewState('lobby');
      setError(null);
      
      // Find current player ID
      const myPlayer = players.find(p => p.socketId === socket.id);
      if (myPlayer) {
        setCurrentPlayerId(myPlayer.id);
      }
    });

    socket.on('lobby:player-joined', (player) => {
      setLobbyPlayers((prev) => [...prev, player]);
    });

    socket.on('lobby:player-left', (playerId) => {
      setLobbyPlayers((prev) => prev.filter((p) => p.id !== playerId));
    });

    socket.on('lobby:left', () => {
      // Reset state and return to home page
      setViewState('home');
      setCurrentLobby(null);
      setLobbyPlayers([]);
      setCurrentPlayerId(undefined);
    });

    socket.on('lobby:error', (message) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    socket.on('game:started', (game) => {
      setCurrentGame(game);
      setViewState('game');
    });

    socket.on('game:finished', () => {
      setTimeout(() => {
        setViewState('home');
        setCurrentLobby(null);
        setCurrentGame(null);
        setLobbyPlayers([]);
      }, 10000);
    });

    return () => {
      socket.off('lobby:updated');
      socket.off('lobby:joined');
      socket.off('lobby:player-joined');
      socket.off('lobby:player-left');
      socket.off('lobby:left');
      socket.off('lobby:error');
      socket.off('game:started');
      socket.off('game:finished');
    };
  }, [socket]);

  const handleCreateLobby = () => {
    setJoinLobbyId(null);
    setShowNicknameModal(true);
  };

  const handleJoinLobby = (lobbyId: string) => {
    setJoinLobbyId(lobbyId);
    setShowNicknameModal(true);
  };

  const handleSubmitNickname = () => {
    if (!socket || !nickname.trim()) {
      setError('Please enter a nickname');
      setTimeout(() => setError(null), 3000);
      return;
    }

    console.log('Submitting nickname:', nickname.trim());
    console.log('Socket connected:', socket.connected);
    console.log('Join lobby ID:', joinLobbyId);

    if (joinLobbyId) {
      console.log('Emitting lobby:join event');
      socket.emit('lobby:join', joinLobbyId, nickname.trim());
    } else {
      console.log('Emitting lobby:create event');
      socket.emit('lobby:create', nickname.trim());
    }

    setShowNicknameModal(false);
    setNickname('');
  };

  if (!socket) {
    return (
      <div className="loading">
        <p>Connecting to server...</p>
      </div>
    );
  }

  if (viewState === 'game' && currentGame) {
    return <Game game={currentGame} currentPlayerId={currentPlayerId} />;
  }

  if (viewState === 'lobby' && currentLobby) {
    return (
      <Lobby
        lobby={currentLobby}
        players={lobbyPlayers}
        currentPlayerId={currentPlayerId}
      />
    );
  }

  return (
    <div className="home-container">
      <div className="hero">
        <h1>TrivAI-l Pursuit</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="main-content">
        <div className="create-lobby-section">
          <h2>Create New Game</h2>
          <p>Start a new lobby and invite your friends</p>
          <button onClick={handleCreateLobby} className="btn-primary">
            Create Lobby
          </button>
        </div>

        <div className="lobbies-section">
          <h2>Join Existing Game</h2>
          {availableLobbies.length === 0 ? (
            <p className="no-lobbies">No lobbies available. Create one!</p>
          ) : (
            <div className="lobbies-list">
              {availableLobbies.map((lobby) => (
                <div key={lobby.id} className="lobby-card">
                  <div className="lobby-info">
                    <h3>Lobby {lobby.id.substring(0, 8)}</h3>
                    <p>
                      {lobby.playerCount} / {lobby.maxPlayers} players
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoinLobby(lobby.id)}
                    className="btn-join"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNicknameModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Enter Your Nickname</h2>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitNickname()}
              placeholder="Your nickname"
              maxLength={20}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={handleSubmitNickname} className="btn-primary">
                Continue
              </button>
              <button
                onClick={() => {
                  setShowNicknameModal(false);
                  setNickname('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .home-container {
          min-height: 100vh;
          padding: 2rem;
        }

        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          font-size: 1.2rem;
          color: var(--text-primary);
        }

        .hero {
          text-align: center;
          color: var(--text-primary);
          margin-bottom: 3rem;
        }

        .hero h1 {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .hero p {
          font-size: 1.2rem;
          opacity: 0.9;
        }

        .error-banner {
          background: var(--danger);
          color: white;
          padding: 1rem;
          border-radius: 4px;
          margin-bottom: 2rem;
          text-align: center;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }

        .main-content {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 2rem;
        }

        .create-lobby-section,
        .lobbies-section {
          background: var(--card-bg);
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 20px var(--shadow);
          transition: background-color 0.3s ease;
        }

        .create-lobby-section {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }

        h2 {
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        p {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .btn-primary {
          padding: 1rem 2rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover {
          background: var(--primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--shadow-hover);
        }

        .no-lobbies {
          text-align: center;
          color: var(--text-tertiary);
          font-style: italic;
        }

        .lobbies-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .lobby-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: var(--card-hover);
          border-radius: 4px;
          transition: all 0.2s;
          border: 1px solid var(--border);
        }

        .lobby-card:hover {
          background: var(--bg-secondary);
          box-shadow: 0 2px 8px var(--shadow);
        }

        .lobby-info h3 {
          margin: 0 0 0.25rem 0;
          color: var(--text-primary);
          font-size: 1rem;
        }

        .lobby-info p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .btn-join {
          padding: 0.5rem 1.5rem;
          background: var(--success);
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-join:hover {
          background: var(--success-hover);
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal {
          background: var(--card-bg);
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 20px var(--shadow-hover);
          max-width: 400px;
          width: 90%;
        }

        .modal h2 {
          margin-bottom: 1.5rem;
          text-align: center;
          color: var(--text-primary);
        }

        .modal input {
          width: 100%;
          padding: 1rem;
          border: 2px solid var(--border);
          border-radius: 4px;
          font-size: 1rem;
          margin-bottom: 1.5rem;
          box-sizing: border-box;
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .modal input:focus {
          outline: none;
          border-color: var(--primary);
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
        }

        .modal-actions button {
          flex: 1;
          padding: 0.75rem;
          border: none;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: var(--border);
          color: var(--text-primary);
        }

        .btn-secondary:hover {
          background: var(--card-hover);
        }

        @media (max-width: 768px) {
          .main-content {
            grid-template-columns: 1fr;
          }

          .hero h1 {
            font-size: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
