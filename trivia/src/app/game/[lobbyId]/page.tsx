'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSocket } from '@/components/SocketProvider';
import { GameState, Question, Player } from '@/lib/types';
import { PartyPopper, X, Check, Pause, ArrowRight } from 'lucide-react';

export default function GamePage() {
  const socket = useSocket();
  const router = useRouter();
  const params = useParams();
  const lobbyId = params.lobbyId as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | undefined>();
  const [hostId, setHostId] = useState<string | undefined>();
  const [timedMode, setTimedMode] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<Omit<Question, 'correctAnswer'> | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; correctAnswer: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(10000); // in milliseconds
  const TOTAL_TIME = 10000; // 10 seconds in milliseconds
  const [isFinished, setIsFinished] = useState(false);
  const [finalScores, setFinalScores] = useState<{ playerId: string; nickname: string; score: number }[]>([]);
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);

  useEffect(() => {
    if (!socket) return;

    // Request game data and lobby data on mount
    console.log('Requesting game data for lobby:', lobbyId);
    socket.emit('game:get', lobbyId);
    socket.emit('lobby:get', lobbyId);

    const handleLobbyData = (lobby: any, players: Player[]) => {
      console.log('Lobby data received:', lobby);
      setHostId(lobby.hostId);
      setTimedMode(lobby.timedMode ?? true);
    };

    const handleGameData = (game: GameState) => {
      console.log('Game data received:', game);
      setPlayers(game.players);
      setTotalQuestions(game.questions.length);
      
      // Find current player ID from socket data
      const myPlayer = game.players.find(p => p.socketId === socket.id);
      if (myPlayer) {
        setCurrentPlayerId(myPlayer.id);
        console.log('Current player ID:', myPlayer.id);
      }
    };

    const handleGameQuestion = (question: Omit<Question, 'correctAnswer'>, qNum: number, total: number) => {
      setCurrentQuestion(question);
      setQuestionNumber(qNum);
      setTotalQuestions(total);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setTimeLeft(10000); // Reset to 10 seconds in milliseconds
    };

    const handleAnswerResult = (correct: boolean, correctAnswer: number) => {
      setAnswerResult({ correct, correctAnswer });
    };

    const handleRoundEnd = (scores: { playerId: string; score: number }[]) => {
      console.log('Round end, updating scores:', scores);
      // Update player scores in real-time
      setPlayers(prevPlayers => 
        prevPlayers.map(player => {
          const updatedScore = scores.find(s => s.playerId === player.id);
          return updatedScore ? { ...player, score: updatedScore.score } : player;
        })
      );
    };

    const handleGameFinished = (scores: { playerId: string; nickname: string; score: number }[], questions?: Question[]) => {
      setIsFinished(true);
      setFinalScores(scores);
      if (questions) {
        setReviewQuestions(questions);
      }
    };

    const handleGameStarted = (game: GameState) => {
      console.log('Game started event:', game);
      setPlayers(game.players);
      setTotalQuestions(game.questions.length);
      
      // Find current player ID
      const myPlayer = game.players.find(p => p.socketId === socket.id);
      if (myPlayer) {
        setCurrentPlayerId(myPlayer.id);
      }
    };

    // Register event listeners
    socket.on('lobby:data', handleLobbyData);
    socket.on('game:data', handleGameData);
    socket.on('game:started', handleGameStarted);
    socket.on('game:question', handleGameQuestion);
    socket.on('game:answer-result', handleAnswerResult);
    socket.on('game:round-end', handleRoundEnd);
    socket.on('game:finished', handleGameFinished);

    return () => {
      socket.off('lobby:data', handleLobbyData);
      socket.off('game:data', handleGameData);
      socket.off('game:started', handleGameStarted);
      socket.off('game:question', handleGameQuestion);
      socket.off('game:answer-result', handleAnswerResult);
      socket.off('game:round-end', handleRoundEnd);
      socket.off('game:finished', handleGameFinished);
    };
  }, [socket, lobbyId]);

  // Timer countdown (only in timed mode)
  useEffect(() => {
    if (!timedMode || timeLeft <= 0 || !currentQuestion) return;

    const timer = setTimeout(() => {
      setTimeLeft(Math.max(0, timeLeft - 50)); // Decrease by 50ms for smooth animation
    }, 50);

    return () => clearTimeout(timer);
  }, [timeLeft, currentQuestion, timedMode]);

  const handleAnswer = (answerIndex: number) => {
    if (!socket || !currentQuestion || selectedAnswer !== null) return;

    setSelectedAnswer(answerIndex);
    socket.emit('game:answer', currentQuestion.id, answerIndex);
  };

  const handleNextQuestion = () => {
    if (!socket) return;
    socket.emit('game:next-question');
  };

  const handleReturnHome = () => {
    if (socket) {
      socket.emit('lobby:leave');
    }
    router.push('/');
  };

  const currentPlayer = players.find((p) => p.id === currentPlayerId);

  if (!socket) {
    return (
      <div className="loading">
        <p>Connecting to server...</p>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="game-container">
        <div className="game-finished">
          <h2><PartyPopper className="inline-icon" /> Game Finished!</h2>
          <div className="final-scores">
            <h3>Final Scores</h3>
            {finalScores.map((score, index) => (
              <div key={score.playerId} className="score-item">
                <span className="rank">#{index + 1}</span>
                <span className="nickname">{score.nickname}</span>
                <span className="score">{score.score} points</span>
              </div>
            ))}
          </div>
          
          {reviewQuestions.length > 0 && (
            <div className="question-review">
              <h3>Question Review</h3>
              {reviewQuestions.map((q, index) => (
                <div key={q.id} className="review-item">
                  <div className="review-question">
                    <strong>Q{index + 1}:</strong> {q.question}
                  </div>
                  <div className="review-options">
                    {q.options.map((option, optIndex) => (
                      <div
                        key={optIndex}
                        className={`review-option ${optIndex === q.correctAnswer ? 'correct-answer' : ''}`}
                      >
                        {optIndex === q.correctAnswer && <Check className="inline-icon-sm" />}{option}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button onClick={handleReturnHome} className="btn-home">
            Return to Home
          </button>
        </div>

        <style jsx>{`
          .game-container {
            min-height: 100vh;
            padding: 2rem;
            display: flex;
            justify-content: center;
            align-items: center;
            background: var(--bg-primary);
          }

          .game-finished {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 3rem;
            box-shadow: 0 4px 20px var(--shadow);
            text-align: center;
            transition: background-color 0.3s ease;
            max-width: 600px;
            width: 100%;
          }

          .game-finished h2 {
            color: var(--text-primary);
            margin-bottom: 1.6rem;
            font-size: 2rem;
          }

          .final-scores h3 {
            margin-bottom: 1.2rem;
            color: var(--text-secondary);
            font-size: 1.2rem;
          }

          .score-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            margin-bottom: 0.6rem;
            background: var(--card-hover);
            border-radius: 8px;
            border: 1px solid var(--border);
          }

          .rank {
            font-weight: bold;
            font-size: 1.3rem;
            color: var(--primary);
            min-width: 50px;
          }

          .nickname {
            flex: 1;
            text-align: left;
            margin-left: 1rem;
            color: var(--text-primary);
            font-size: 1.1rem;
          }

          .score {
            font-weight: 600;
            color: var(--success);
            font-size: 1.1rem;
          }

          .btn-home {
            margin-top: 1.6rem;
            padding: 1rem 2rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-home:hover {
            background: var(--primary-hover);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px var(--shadow-hover);
          }

          .question-review {
            margin-top: 1.6rem;
            text-align: left;
            max-height: 400px;
            overflow-y: auto;
            padding: 1.5rem;
            background: var(--bg-secondary);
            border-radius: 8px;
          }

          .question-review h3 {
            margin-bottom: 0.8rem;
            color: var(--text-primary);
            text-align: center;
            font-size: 1.1rem;
          }

          .review-item {
            margin-bottom: 1.2rem;
            padding: 1rem;
            background: var(--card-bg);
            border-radius: 6px;
            border: 1px solid var(--border);
          }

          .review-question {
            margin-bottom: 0.6rem;
            color: var(--text-primary);
            font-size: 0.95rem;
            line-height: 1.4;
          }

          .review-question strong {
            color: var(--primary);
          }

          .review-options {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-left: 1rem;
          }

          .review-option {
            padding: 0.5rem 0.75rem;
            background: var(--card-hover);
            border-radius: 4px;
            font-size: 0.9rem;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 0.35rem;
          }

          .review-option.correct-answer {
            background: var(--success);
            color: white;
            font-weight: 600;
          }

          @media (max-width: 768px) {
            .game-container {
              padding: 0;
            }

            .game-finished {
              max-width: 100%;
              border-radius: 0;
              box-shadow: none;
              padding: 2rem 1rem;
              min-height: 100vh;
            }

            .game-finished h2 {
              font-size: 1.5rem;
            }

            .question-review {
              padding: 1rem;
              border-radius: 0;
              margin-left: -1rem;
              margin-right: -1rem;
              max-height: none;
            }

            .review-item {
              border-radius: 4px;
            }

            .final-scores {
              margin-bottom: 0.9rem;
            }

            .btn-home {
              width: 100%;
              margin-top: 0.9rem;
            }

            .score-item {
              padding: 0.875rem;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="question-info">
          Question {questionNumber} of {totalQuestions}
        </div>
        {timedMode ? (
          <div className="timer-container">
            <div className="timer">{(timeLeft / 1000).toFixed(2)}s</div>
            <div className="timer-bar-container">
              <div 
                className="timer-bar" 
                style={{ width: `${(timeLeft / TOTAL_TIME) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="timeless-mode-indicator">
            <span className="mode-badge"><Pause className="inline-icon-sm" /> Timeless Mode</span>
          </div>
        )}
        <div className="score">Your Score: {currentPlayer?.score || 0}</div>
      </div>

      {currentQuestion && (
        <div className="question-card">
          <h2 className="question-text">{currentQuestion.question}</h2>


          <div className="answers">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = answerResult?.correctAnswer === index;
              const showCorrect = answerResult !== null;

              let className = 'answer-btn';
              if (isSelected) className += ' selected';
              if (showCorrect && isCorrect) className += ' correct';
              if (showCorrect && isSelected && !isCorrect) className += ' incorrect';

              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  disabled={selectedAnswer !== null}
                  className={className}
                >
                  {option}
                  {showCorrect && isCorrect && <Check className="inline-icon-sm" />}
                  {showCorrect && isSelected && !isCorrect && <X className="inline-icon-sm" />}
                </button>
              );
            })}
          </div>

          {answerResult && (
            <div className={`result ${answerResult.correct ? 'correct-result' : 'incorrect-result'}`}>
              {answerResult.correct ? (
                <><PartyPopper className="inline-icon" /> Correct! +10 points</>
              ) : (
                <><X className="inline-icon" /> Incorrect</>
              )}
            </div>
          )}

          {!timedMode && hostId === currentPlayerId && (
            <button onClick={handleNextQuestion} className="next-question-btn">
              Next Question <ArrowRight className="inline-icon-sm" />
            </button>
          )}
        </div>
      )}

      <div className="scoreboard">
        <h3>Live Scores</h3>
        <div className="scores-list">
          {players
            .sort((a, b) => b.score - a.score)
            .map((player) => (
              <div key={player.id} className="score-item">
                <span className="player-name">
                  {player.nickname}
                  {player.id === currentPlayerId && ' (You)'}
                </span>
                <span className="player-score">{player.score}</span>
              </div>
            ))}
        </div>
      </div>

      <style jsx>{`
        .game-container {
          min-height: 100vh;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
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

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--card-bg);
          padding: 1.25rem;
          border-radius: 12px;
          margin-bottom: 1.6rem;
          box-shadow: 0 2px 10px var(--shadow);
          transition: background-color 0.3s ease;
        }

        .question-info,
        .timer,
        .score {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 1rem;
        }

        .timer-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
          max-width: 250px;
        }

        .timer {
          font-size: 1.3rem;
          color: ${timeLeft <= 5000 ? 'var(--danger)' : 'var(--text-primary)'};
          font-variant-numeric: tabular-nums;
        }

        .timer-bar-container {
          width: 150%;
          height: 8px;
          background: var(--border);
          border-radius: 4px;
          overflow: hidden;
        }

        .timer-bar {
          height: 100%;
          background: ${timeLeft <= 5000 ? 'var(--danger)' : timeLeft <= 7000 ? 'var(--warning)' : 'var(--success)'};
          transition: width 0.05s linear, background 0.3s ease;
          border-radius: 4px;
        }

        .question-card {
          background: var(--card-bg);
          padding: 2.5rem;
          border-radius: 12px;
          margin-bottom: 1.6rem;
          box-shadow: 0 4px 20px var(--shadow);
          transition: background-color 0.3s ease;
        }

        .question-text {
          color: var(--text-primary);
          margin-bottom: 1.2rem;
          font-size: 1.5rem;
          line-height: 1.4;
          margin: 0;
          margin-bottom: 1rem;
        }

        .question-meta {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.6rem;
        }

        .category,
        .difficulty {
          padding: 0.4rem 0.9rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .category {
          background: var(--info);
          color: white;
        }

        .difficulty {
          background: var(--warning);
          color: white;
        }

        .answers {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.2rem;
        }

        .answer-btn {
          padding: 1.5rem;
          border: 2px solid var(--border);
          border-radius: 8px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          font-weight: 500;
        }

        @media (hover: hover) and (pointer: fine) {
          .answer-btn:hover:not(:disabled) {
            border-color: var(--primary);
            background: var(--card-hover);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px var(--shadow);
          }
        }

        .answer-btn:disabled {
          cursor: not-allowed;
        }

        .answer-btn.selected {
          border-color: var(--primary);
          background: var(--info);
          color: white;
        }

        .answer-btn.correct {
          border-color: var(--success);
          background: var(--success);
          color: white;
        }

        .answer-btn.incorrect {
          border-color: var(--danger);
          background: var(--danger);
          color: white;
        }

        .result {
          padding: 1.25rem;
          border-radius: 8px;
          text-align: center;
          font-weight: 600;
          font-size: 1.2rem;
        }

        .correct-result {
          background: var(--success);
          color: white;
        }

        .incorrect-result {
          background: var(--danger);
          color: white;
        }

        .timeless-mode-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
        }

        .mode-badge {
          background: var(--info);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .next-question-btn {
          width: 100%;
          margin-top: 1.5rem;
          padding: 1.25rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .next-question-btn:hover {
          background: var(--primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--shadow-hover);
        }

        .inline-icon {
          display: inline-block;
          width: 1.25em;
          height: 1.25em;
          vertical-align: text-bottom;
          margin-right: 0.25rem;
        }

        .inline-icon-sm {
          display: inline-block;
          width: 1em;
          height: 1em;
          vertical-align: text-bottom;
          margin-left: 0.35rem;
        }

        .scoreboard {
          background: var(--card-bg);
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 10px var(--shadow);
          transition: background-color 0.3s ease;
        }

        .scoreboard h3 {
          margin-bottom: 0.8rem;
          color: var(--text-primary);
          font-size: 1.1rem;
        }

        .scores-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .score-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem;
          background: var(--card-hover);
          border-radius: 6px;
          border: 1px solid var(--border);
        }

        .player-name {
          color: var(--text-primary);
          font-weight: 500;
        }

        .player-score {
          font-weight: 600;
          color: var(--success);
        }

        @media (max-width: 768px) {
          .game-container {
            padding: 0;
          }

          .game-header {
            flex-direction: column;
            gap: 0.5rem;
            text-align: center;
            padding: 1rem;
            background: var(--card-bg);
            border-radius: 0;
            box-shadow: none;
            border-bottom: 1px solid var(--border);
            margin-bottom: 0;
          }

          .question-card {
            border-radius: 0;
            box-shadow: none;
            padding: 1.5rem 1rem;
            margin-bottom: 0;
          }

          .question-text {
            font-size: 1.2rem;
            margin-bottom: 1.2rem;
          }

          .question-meta {
            margin-bottom: 1.2rem;
          }

          .answers {
            grid-template-columns: 1fr;
            gap: 0.75rem;
            margin-bottom: 1.2rem;
          }

          .answer-btn {
            padding: 1.25rem;
            font-size: 1rem;
            border-radius: 8px;
          }

          .result {
            border-radius: 0;
            margin-left: -1rem;
            margin-right: -1rem;
            padding: 1rem;
          }

          .scoreboard {
            border-radius: 0;
            box-shadow: none;
            padding: 1.5rem 1rem;
            border-top: 1px solid var(--border);
          }

          .score-item {
            padding: 0.75rem;
          }

          .btn-home {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
