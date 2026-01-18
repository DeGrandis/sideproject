'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/components/SocketProvider';
import { LobbyInfo } from '@/lib/types';

export default function HomePage() {
  const socket = useSocket();
  const router = useRouter();
  const [availableLobbies, setAvailableLobbies] = useState<LobbyInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [joinLobbyId, setJoinLobbyId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');

  // Load saved nickname from localStorage on mount
  useEffect(() => {
    const savedNickname = localStorage.getItem('trivia-nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Request initial lobby list
    socket.emit('lobby:list');

    // Update lobby list when it changes
    socket.on('lobby:updated', (lobbies) => {
      setAvailableLobbies(lobbies);
    });

    // Navigate to lobby page when joined
    socket.on('lobby:joined', (lobby) => {
      router.push(`/lobby/${lobby.id}`);
    });

    socket.on('lobby:error', (message) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    return () => {
      socket.off('lobby:updated');
      socket.off('lobby:joined');
      socket.off('lobby:error');
    };
  }, [socket, router]);

  const handleCreateLobby = () => {
    router.push('/create-lobby');
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

    if (!joinLobbyId) {
      setError('No lobby selected');
      setTimeout(() => setError(null), 3000);
      return;
    }

    console.log('Joining lobby:', joinLobbyId, 'with nickname:', nickname.trim());
    
    // Save nickname to localStorage
    localStorage.setItem('trivia-nickname', nickname.trim());
    
    socket.emit('lobby:join', joinLobbyId, nickname.trim());

    setShowNicknameModal(false);
    setJoinLobbyId(null);
  };

  const handleNicknameChange = (newNickname: string) => {
    setNickname(newNickname);
    if (newNickname.trim()) {
      localStorage.setItem('trivia-nickname', newNickname.trim());
    }
  };

  if (!socket) {
    return (
      <div className="loading">
        <p>Connecting to server...</p>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="hero">
        <h1>Infinitivia</h1>
      </div>


          
          
      {error && <div className="error-banner">{error}</div>}

      <div className="main-content">
        <div className="create-lobby-section">
          <h2>Start a Game</h2>
          <p>Start a new lobby and invite your friends</p>
          

          
          <button onClick={handleCreateLobby} className="btn-primary">
            Create Lobby
          </button>

                    {nickname && (
            <div className="nickname-display">
              <label htmlFor="nickname-input">Your Nickname</label>
              <input
                id="nickname-input"
                type="text"
                value={nickname}
                onChange={(e) => handleNicknameChange(e.target.value)}
                placeholder="Enter your nickname"
                maxLength={20}
              />
            </div>
          )}
        </div>

        <div className="lobbies-section">
          <h2>Lobbies</h2>
          {availableLobbies.length === 0 ? (
            <p className="no-lobbies">No lobbies available. Create one!</p>
          ) : (
            <div className="lobbies-list">
              {availableLobbies.map((lobby) => (
                <div key={lobby.id} className="lobby-card">
                  <div className="lobby-info">
                    <h3>{lobby.name}</h3>
                    <div className="lobby-details">
                      <span className="lobby-detail">
                        👥 {lobby.playerCount} / {lobby.maxPlayers}
                      </span>
                      <span className="lobby-detail difficulty">
                        {lobby.difficulty.charAt(0).toUpperCase() + lobby.difficulty.slice(1)}
                      </span>
                      {lobby.theme && (
                        <span className="lobby-detail theme" title={lobby.theme}>
                          🎯 {lobby.theme.length > 30 ? lobby.theme.substring(0, 30) + '...' : lobby.theme}
                        </span>
                      )}
                    </div>
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

        .nickname-display {
          width: 100%;
          margin-top: 1.5rem;
          padding: 1.1rem;
          background: var(--bg-secondary);
          border-radius: 8px;

        }

        .nickname-display label {
          display: block;
          color: var(--text-primary);
          font-size: 0.95rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .nickname-display input {
          width: 100%;
          padding: 1rem;
          border: 2px solid var(--border);
          border-radius: 4px;
          font-size: 1rem;
          box-sizing: border-box;
          background: var(--card-bg);
          color: var(--text-primary);
          transition: border-color 0.2s;
        }

        .nickname-display input:focus {
          outline: none;
          border-color: var(--primary);
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

        .lobby-info {
          flex: 1;
        }

        .lobby-info h3 {
          margin: 0 0 0.5rem 0;
          color: var(--text-primary);
          font-size: 1.1rem;
        }

        .lobby-details {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .lobby-detail {
          font-size: 0.85rem;
          color: var(--text-secondary);
          padding: 0.25rem 0.5rem;
          background: var(--bg-secondary);
          border-radius: 4px;
        }

        .lobby-detail.difficulty {
          font-weight: 600;
          background: var(--primary);
          color: white;
        }

        .lobby-detail.theme {
          font-style: italic;
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
