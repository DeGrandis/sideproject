'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/components/SocketProvider';
import { LobbyInfo } from '@/lib/types';
import { Users, Info } from 'lucide-react';

export default function HomePage() {
  const socket = useSocket();
  const router = useRouter();
  const [availableLobbies, setAvailableLobbies] = useState<LobbyInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isClosingInfoModal, setIsClosingInfoModal] = useState(false);
  const [infoCarouselIndex, setInfoCarouselIndex] = useState(0);
  const [joinLobbyId, setJoinLobbyId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Load saved nickname and theme from localStorage on mount
  useEffect(() => {
    const savedNickname = localStorage.getItem('trivia-nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
    
    const savedTheme = localStorage.getItem('trivia-theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      setIsDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
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
    if (nickname.trim()) {
      // User already has a nickname, join directly
      console.log('Joining lobby:', lobbyId, 'with nickname:', nickname.trim());
      socket?.emit('lobby:join', lobbyId, nickname.trim());
    } else {
      // No nickname set, show modal
      setJoinLobbyId(lobbyId);
      setShowNicknameModal(true);
    }
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

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    const theme = newMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('trivia-theme', theme);
  };

  const handleNicknameChange = (newNickname: string) => {
    setNickname(newNickname);
    if (newNickname.trim()) {
      localStorage.setItem('trivia-nickname', newNickname.trim());
    } else {
      localStorage.removeItem('trivia-nickname');
    }
  };

  const closeInfoModal = () => {
    setIsClosingInfoModal(true);
    setTimeout(() => {
      setShowInfoModal(false);
      setIsClosingInfoModal(false);
      setInfoCarouselIndex(0);
    }, 300);
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
        <h1>
          <div className="infinity-container">
            <svg className="infinity-symbol" viewBox="0 0 100 35" xmlns="http://www.w3.org/2000/svg">
              <path d="M 10,17.5 C 10,8 20,4 30,4 C 40,4 45,12 50,17.5 C 55,23 60,31 70,31 C 80,31 90,27 90,17.5 C 90,8 80,4 70,4 C 60,4 55,12 50,17.5 C 45,23 40,31 30,31 C 20,31 10,27 10,17.5 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="3"/>
              <circle className="swoosh" r="10" fill="var(--primary)">
                <animateMotion
                  dur="5s"
                  repeatCount="indefinite"
                  path="M 10,17.5 C 10,8 20,4 30,4 C 40,4 45,12 50,17.5 C 55,23 60,31 70,31 C 80,31 90,27 90,17.5 C 90,8 80,4 70,4 C 60,4 55,12 50,17.5 C 45,23 40,31 30,31 C 20,31 10,27 10,17.5 Z"
                  calcMode="linear"
                />
              </circle>
            </svg>
          </div>
          Infinitivia
        </h1>
      </div>


      {error && <div className="error-banner">{error}</div>}

      <div className="main-content">
        <div className="create-lobby-section">
          <div className="section-header">
            <h2>Start a Game</h2>
            <button
              className="info-icon-btn"
              onClick={() => setShowInfoModal(true)}
              title="Learn more"
            >
              <Info size={20} />
            </button>
          </div>
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
                        <Users size={16} className="inline-icon-sm" /> {lobby.playerCount} / {lobby.maxPlayers}
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

      {showInfoModal && (
        <div className={`modal-overlay ${isClosingInfoModal ? 'closing' : ''}`}>
          <div className={`modal ${isClosingInfoModal ? 'closing' : ''}`}>
            <h2>How To Play</h2>
            
            {infoCarouselIndex === 0 && (
              <div className="carousel-section">
                <p>Create or join a lobby to start playing trivia with your friends in real-time.</p>
              </div>
            )}
            
            {infoCarouselIndex === 1 && (
              <div className="carousel-section">
                <p>Enter a theme and let AI generate trivia questions related to it.</p>
              </div>
            )}
            
            {infoCarouselIndex === 2 && (
              <div className="carousel-section">
                <p>Once you create a lobby, invite your friends to join using the ID or by sharing the link.</p>
              </div>
            )}
            
            <div className="carousel-controls">
              <span className="carousel-indicator">{infoCarouselIndex + 1} / 3</span>
              <button
                onClick={() => setInfoCarouselIndex((infoCarouselIndex + 1) % 3)}
                className="carousel-next-btn"
                title="Next"
              >
                →
              </button>
            </div>
            
            <div className="modal-actions">
              <button
                onClick={closeInfoModal}
                className="btn-primary"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

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

      <footer className="page-footer">
        <p>&copy; 2026 Infinitivia by <a href="https://degrand.is" target="_blank" rel="noopener noreferrer">DEGRAND.IS</a> // All rights reserved.</p>
      </footer>

      <style jsx>{`
        .home-container {
          min-height: 100vh;
          padding: 2rem;
          padding-bottom: 8rem;
        }

        .page-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--bg-tertiary);
          border-top: 1px solid var(--border);
          padding: 1.5rem 2rem;
          text-align: center;
          color: var(--text-secondary);
          font-size: 0.9rem;
          z-index: 99;
        }

        .page-footer p {
          margin: 0;
          color: var(--text-secondary);
        }

        .page-footer a {
          background: linear-gradient(90deg, #2196f3, #76b2e4, #2196f3);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-decoration: none;
          font-weight: bold;
          text-transform: lowercase;
          animation: gradientPulse 4s ease-in-out infinite;
        }

        @keyframes gradientPulse {
          0%, 100% {
            background-position: 0% center;
          }
          50% {
            background-position: 100% center;
          }
        }

        .page-footer a:hover {
          opacity: 0.8;
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
          margin-bottom: 2.4rem;
        }

        .hero h1 {
          font-size: 3rem;
          margin-bottom: 0.4rem;
          display: inline-block;
          position: relative;
        }

        .infinity-container {
          position: absolute;
          left: -70px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
        }

        .infinity-symbol {
          width: 60px;
          height: 30px;
          color: var(--text-primary);
        }

        .swoosh {
          filter: drop-shadow(0 0 8px var(--primary));
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
          margin-bottom: 1.6rem;
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
          padding: 1.4rem 1.4rem;
          border-radius: 8px;
          box-shadow: 0 4px 20px var(--shadow);
          transition: background-color 0.3s ease;
        }
.section-header {
          position: relative;
          display: inline-block;
          width: 100%;
          text-align: center;
        }

        .section-header h2 {
          margin: 0;
          display: inline-block;
        }

        .info-icon-btn {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .info-icon-btn:hover {
          color: var(--primary);
          transform: translateY(-50%) scale(1.2);
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
          margin-bottom: 0.4rem;
        }

        p {
          color: var(--text-secondary);
          margin-bottom: 1.2rem;
        }

        .nickname-display {
          width: 100%;
          margin-top: 1rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border-radius: 8px;
        }

        .nickname-display label {
          display: block;
          color: var(--text-primary);
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 0.6rem;
        }

        .nickname-display input {
          width: 100%;
          padding: .9rem;
          border: 2px solid var(--border);
          border-radius: 4px;
          font-size: .9rem;
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


        .carousel-section {
          min-height: 60px;
          display: flex;
          align-items: center;
          justify-content: left;
          margin-bottom: 1rem;
          animation: slideIn 0.5s ease-in-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .carousel-section p {
          margin: 0;
          text-align: justify;
          font-size: 1rem;
          line-height: 1.4;
        }

        .carousel-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .carousel-indicator {
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 600;
        }

        .carousel-next-btn {
          background: var(--primary);
          color: white;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 1.2rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .carousel-next-btn:hover {
          background: var(--primary-hover);
          animation: bounce 0.2s ease-in-out;
        }

        @keyframes bounce {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
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
          animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .modal {
          background: var(--card-bg);
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 20px var(--shadow-hover);
          max-width: 400px;
          width: 90%;
          animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes popIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes popOut {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.8);
          }
        }

        .modal-overlay.closing {
          animation: fadeOut 0.3s ease-in-out;
        }

        @keyframes fadeOut {
          from {
            opacity: 0.5;
          }
          to {
            opacity: 0;
          }
        }

        .modal.closing {
          animation: popOut 0.5s cubic-bezier(0.64, 0, 0.78, 0);
        }

        .modal h2 {
          margin-bottom: 1.2rem;
          text-align: center;
          color: var(--text-primary);
        }

        .modal input {
          width: 100%;
          padding: 1rem;
          border: 2px solid var(--border);
          border-radius: 4px;
          font-size: 1rem;
          margin-bottom: 1.2rem;
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
          c

          .infinity-symbol {
            width: 45px;
            height: 22px;
          }olor: var(--text-primary);
        }

        .theme-toggle {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--card-bg);
          border: 2px solid var(--border);
          font-size: 1.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px var(--shadow);
          transition: all 0.3s ease;
          z-index: 100;
        }

        .theme-toggle:hover {
          transform: scale(1.1) rotate(15deg);
          box-shadow: 0 6px 20px var(--shadow-hover);
        }

        .btn-secondary:hover {
          background: var(--card-hover);
        }

        @media (max-width: 768px) {
          .home-container {
            padding: 0;
          }

          .hero {
            padding: 1.5rem 1rem;
            margin-bottom: 0;
          }

          .hero h1 {
            font-size: 2rem;
          }

          .hero p {
            font-size: 1rem;
          }

          .error-banner {
            border-radius: 0;
            margin-bottom: 0;
          }

          .main-content {
            grid-template-columns: 1fr;

          .theme-toggle {
            bottom: 1rem;
            right: 1rem;
            width: 50px;
            height: 50px;
            font-size: 1.2rem;
          }
            gap: 0;
          }

          .create-lobby-section,
          .lobbies-section {
            border-radius: 0;
            box-shadow: none;
            padding: 1.25rem 1rem;
            border-top: 1px solid var(--border);
          }

          .create-lobby-section {
            border-bottom: 1px solid var(--border);
          }

          .nickname-display {
            padding: 0.9rem;
          }

          .modal {
            border-radius: 12px;
            width: calc(100% - 2rem);
            margin: 1rem;
          }

          .home-container {
            padding-bottom: 7rem;
          }

          .page-footer {
            padding: 1rem 1rem;
            font-size: 0.8rem;
          }

          .page-footer p {
            margin: 0;
          }

        }
      `}</style>
    </div>
  );
}
