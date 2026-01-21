'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/components/SocketProvider';
import { Pause, Clock } from 'lucide-react';

export default function CreateLobbyPage() {
  const socket = useSocket();
  const router = useRouter();
  
  const [nickname, setNickname] = useState('');
  const [showNicknameField, setShowNicknameField] = useState(false);
  const [playerLimit] = useState(10);
  const [questionCount, setQuestionCount] = useState(3);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [theme, setTheme] = useState('');
  const [timedMode, setTimedMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Load saved nickname from localStorage on mount
  useEffect(() => {
    const savedNickname = localStorage.getItem('trivia-nickname');
    if (savedNickname) {
      setNickname(savedNickname);
      setShowNicknameField(false);
    } else {
      setShowNicknameField(true);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Navigate to lobby page when lobby is created and joined
    const handleLobbyJoined = (lobby: any, players: any[]) => {
      console.log('Lobby created successfully:', lobby);
      console.log('Players:', players);
      setIsCreating(false);
      // Pass lobby and players data as state to avoid waiting for socket event replay
      router.push(`/lobby/${lobby.id}?initial=true`);
    };

    // Set up event listener for lobby errors
    const handleLobbyError = (message: string) => {
      console.error('Lobby error:', message);
      setError(message);
      setIsCreating(false);
      setTimeout(() => setError(null), 3000);
    };

    socket.on('lobby:joined', handleLobbyJoined);
    socket.on('lobby:error', handleLobbyError);

    return () => {
      socket.off('lobby:joined', handleLobbyJoined);
      socket.off('lobby:error', handleLobbyError);
    };
  }, [socket, router]);

  const handleCreateLobby = () => {
    // Validation
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    if (questionCount < 2 || questionCount > 10) {
      setError('Question count must be between 2 and 10');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    if (theme.length > 300) {
      setError('Theme description must be 300 characters or less');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!socket) {
      setError('Connection error. Please try again.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Generate random 6-digit lobby name
    const randomLobbyName = Math.floor(100000 + Math.random() * 900000).toString();

    console.log('Creating lobby with:', {
      nickname: nickname.trim(),
      lobbyName: randomLobbyName,
      playerLimit,
      questionCount,
      difficulty,
      theme: theme.trim(),
      timedMode,
    });

    setIsCreating(true);

    // Save nickname to localStorage
    localStorage.setItem('trivia-nickname', nickname.trim());

    // Emit lobby:create event - will navigate on lobby:joined
    socket.emit('lobby:create', {
      nickname: nickname.trim(),
      lobbyName: randomLobbyName,
      maxPlayers: playerLimit,
      questionCount,
      difficulty,
      theme: theme.trim(),
      timedMode,
    });
  };

  const handleCancel = () => {
    router.push('/');
  };

  if (!socket) {
    return (
      <div className="loading">
        <p>Connecting to server...</p>
      </div>
    );
  }

  return (
    <div className="create-lobby-container">
      <div className="create-lobby-card">
        <h1>Create a Lobby</h1>
        
        {error && <div className="error-banner">{error}</div>}
{isCreating && (
        <div className="loading-overlay">
          <div className="loading-modal">
            <div className="spinner"></div>
            <h2>Generating Your Trivia Game...</h2>
            <p>Creating {questionCount} unique questions{theme && ` about ${theme}`}</p>
            <p className="loading-subtext">This may take a few moments</p>
          </div>
        </div>
      )}
      
      
        {showNicknameField && (
          <div className="form-section">
            <label htmlFor="nickname">Your Nickname *</label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
              maxLength={20}
              autoFocus
            />
            <span className="input-hint">{nickname.length}/20 characters</span>
          </div>
        )}

        <div className="form-section">
          <label htmlFor="questionCount">Number of Questions *</label>
          <div className="player-limit-control">
            <button
              type="button"
              onClick={() => setQuestionCount(Math.max(2, questionCount - 1))}
              className="btn-counter"
            >
              -
            </button>
            <input
              id="questionCount"
              type="number"
              value={questionCount}
              onChange={(e) => setQuestionCount(Math.max(2, Math.min(10, parseInt(e.target.value) || 2)))}
              min={2}
              max={10}
              className="player-limit-input"
            />
            <button
              type="button"
              onClick={() => setQuestionCount(Math.min(10, questionCount + 1))}
              className="btn-counter"
            >
              +
            </button>
          </div>
          <span className="input-hint">Between 2 and 10 questions</span>
        </div>

        <div className="form-section">
          <label htmlFor="difficulty">Difficulty *</label>
          <div className="difficulty-selector">
            <button
              type="button"
              className={`difficulty-btn difficulty-easy ${difficulty === 'easy' ? 'active' : ''}`}
              onClick={() => setDifficulty('easy')}
            >
              Easy
            </button>
            <button
              type="button"
              className={`difficulty-btn difficulty-medium ${difficulty === 'medium' ? 'active' : ''}`}
              onClick={() => setDifficulty('medium')}
            >
              Medium
            </button>
            <button
              type="button"
              className={`difficulty-btn difficulty-hard ${difficulty === 'hard' ? 'active' : ''}`}
              onClick={() => setDifficulty('hard')}
            >
              Hard
            </button>
          </div>
        </div>

        <div className="form-section">
          <label htmlFor="gameMode">Game Mode *</label>
          <div className="game-mode-selector">
            <button
              type="button"
              className={`mode-btn ${!timedMode ? 'active' : ''}`}
              onClick={() => setTimedMode(false)}
            >
              <div className="mode-icon"><Pause size={32} /></div>
              <div className="mode-label">Timeless</div>
              <div className="mode-description">Host controls question progression</div>
            </button>
            <button
              type="button"
              className={`mode-btn ${timedMode ? 'active' : ''}`}
              onClick={() => setTimedMode(true)}
            >
              <div className="mode-icon"><Clock size={32} /></div>
              <div className="mode-label">Timed</div>
              <div className="mode-description">10 seconds per question</div>
            </button>
          </div>
        </div>

        <div className="form-section">
          <label htmlFor="theme">Theme (Optional)</label>
          <textarea
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Enter a theme or topic for the trivia questions (e.g., '80s movies', 'Science Fiction', 'World History')..."
            maxLength={300}
            rows={4}
          />
          <span className="input-hint">{theme.length}/300 characters</span>
        </div>

        <div className="ai-disclaimer">
          <p><strong>Note:</strong> The AI may generate incorrect or hallucinated answers.</p>
        </div>

        <div className="form-actions">
          <button 
            onClick={handleCreateLobby} 
            className="btn-primary"
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Lobby'}
          </button>
          <button 
            onClick={handleCancel} 
            className="btn-secondary"
            disabled={isCreating}
          >
            Cancel
          </button>
        </div>
      </div>

      <style jsx>{`
        .create-lobby-container {
          min-height: 100vh;
          padding: 2rem;
          display: flex;
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

        .create-lobby-card {
          background: var(--card-bg);
          padding: 2.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 20px var(--shadow);
          max-width: 600px;
          width: 100%;
        }

        h1 {
          color: var(--text-primary);
          margin-bottom: 1.6rem;
          text-align: center;
          font-size: 2rem;
        }

        .error-banner {
          background: var(--danger);
          color: white;
          padding: 1rem;
          border-radius: 4px;
          margin-bottom: 1.2rem;
          text-align: center;
        }

        .form-section {
          margin-bottom: 1.2rem;
        }

        label {
          display: block;
          color: var(--text-primary);
          font-weight: 600;
          margin-bottom: 0.4rem;
          font-size: 0.95rem;
        }

        input[type="text"],
        input[type="number"],
        textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid var(--border);
          border-radius: 6px;
          font-size: 1rem;
          box-sizing: border-box;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: inherit;
          transition: border-color 0.2s;
        }

        input[type="text"]:focus,
        input[type="number"]:focus,
        textarea:focus {
          outline: none;
          border-color: var(--primary);
        }

        textarea {
          resize: vertical;
          min-height: 100px;
        }

        .input-hint {
          display: block;
          margin-top: 0.2rem;
          font-size: 0.85rem;
          color: var(--text-tertiary);
        }

        .ai-disclaimer {
          background: var(--info);
          border-left: 4px solid var(--info-text);
          padding: 0.75rem 1rem;
          border-radius: 4px;
          margin-bottom: 1.6rem;
        }

        .ai-disclaimer p {
          margin: 0;
          color: var(--info-text);
          font-size: 0.75rem;
          line-height: 1.4;
        }

        .ai-disclaimer strong {
          font-weight: 500;
        }

        .player-limit-control {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .btn-counter {
          width: 40px;
          height: 40px;
          border: 2px solid var(--border);
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 1.25rem;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-counter:hover {
          background: var(--card-hover);
          border-color: var(--primary);
        }

        .player-limit-input {
          flex: 1;
          text-align: center;
          font-weight: 600;
        }

        .difficulty-selector {
          display: flex;
          gap: 0.75rem;
        }

        .difficulty-btn {
          flex: 1;
          padding: 0.75rem;
          border: 2px solid var(--border);
          border-radius: 6px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .difficulty-btn:hover {
          background: var(--card-hover);
          border-color: var(--primary);
        }

        .difficulty-btn.active {
          color: white;
        }

        .difficulty-btn.difficulty-easy.active {
          background: #22c55e;
          border-color: #22c55e;
        }

        .difficulty-btn.difficulty-easy:hover {
          border-color: #22c55e;
        }

        .difficulty-btn.difficulty-medium.active {
          background: var(--primary);
          border-color: var(--primary);
        }

        .difficulty-btn.difficulty-hard.active {
          background: #ef4444;
          border-color: #ef4444;
        }

        .difficulty-btn.difficulty-hard:hover {
          border-color: #ef4444;
        }

        .game-mode-selector {
          display: flex;
          gap: 1rem;
        }

        .mode-btn {
          flex: 1;
          padding: 1.2rem;
          border: 2px solid var(--border);
          border-radius: 8px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .mode-btn:hover {
          background: var(--card-hover);
          border-color: var(--primary);
        }

        .mode-btn.active {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }

        .mode-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .mode-label {
          font-weight: 600;
          font-size: 1.1rem;
          margin-bottom: 0.3rem;
        }

        .mode-description {
          font-size: 0.85rem;
          opacity: 0.8;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.6rem;
        }

        .form-actions button {
          flex: 1;
          padding: 1rem;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: var(--primary);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--shadow-hover);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: var(--border);
          color: var(--text-primary);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--card-hover);
        }

        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
        }

        .loading-modal {
          background: var(--card-bg);
          padding: 3rem;
          border-radius: 12px;
          text-align: center;
          max-width: 500px;
          box-shadow: 0 8px 32px var(--shadow-hover);
        }

        .spinner {
          width: 60px;
          height: 60px;
          border: 4px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.2rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-modal h2 {
          color: var(--text-primary);
          margin-bottom: 0.8rem;
          font-size: 1.5rem;
        }

        .loading-modal p {
          color: var(--text-secondary);
          margin-bottom: 0.4rem;
        }

        .loading-subtext {
          font-size: 0.9rem;
          font-style: italic;
          opacity: 0.8;
        }

        @media (max-width: 768px) {
          .create-lobby-container {
            padding: 0;
            justify-content: flex-start;
          }

          .create-lobby-card {
            max-width: 100%;
            border-radius: 0;
            box-shadow: none;
            padding: 1.5rem 1rem;
            min-height: 100vh;
          }

          h1 {
            font-size: 1.5rem;
            margin-bottom: 0.9rem;
          }

          .difficulty-selector {
            flex-direction: column;
          }

          .form-group {
            margin-bottom: 0.9rem;
          }

          .btn-primary,
          .btn-cancel {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
