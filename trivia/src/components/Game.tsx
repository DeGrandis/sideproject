'use client';

import { useEffect, useState } from 'react';
import { GameState, Question } from '@/lib/types';
import { useSocket } from './SocketProvider';

interface GameProps {
  game: GameState;
  currentPlayerId?: string;
}

export default function Game({ game, currentPlayerId }: GameProps) {
  const socket = useSocket();
  const [players, setPlayers] = useState(game.players);
  const [currentQuestion, setCurrentQuestion] = useState<Omit<Question, 'correctAnswer'> | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; correctAnswer: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isFinished, setIsFinished] = useState(false);
  const [finalScores, setFinalScores] = useState<{ playerId: string; nickname: string; score: number }[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('game:question', (question, qNum, total) => {
      setCurrentQuestion(question);
      setQuestionNumber(qNum);
      setTotalQuestions(total);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setTimeLeft(10);
    });

    socket.on('game:answer-result', (correct, correctAnswer) => {
      setAnswerResult({ correct, correctAnswer });
    });

    socket.on('game:round-end', (scores) => {
      // Update player scores in real-time
      setPlayers(prevPlayers => 
        prevPlayers.map(player => {
          const updatedScore = scores.find(s => s.playerId === player.id);
          return updatedScore ? { ...player, score: updatedScore.score } : player;
        })
      );
    });

    socket.on('game:finished', (scores) => {
      setIsFinished(true);
      setFinalScores(scores);
    });

    return () => {
      socket.off('game:question');
      socket.off('game:answer-result');
      socket.off('game:round-end');
      socket.off('game:finished');
    };
  }, [socket]);

  useEffect(() => {
    if (timeLeft <= 0 || !currentQuestion) return;

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, currentQuestion]);

  const handleAnswer = (answerIndex: number) => {
    if (!socket || !currentQuestion || selectedAnswer !== null) return;

    setSelectedAnswer(answerIndex);
    socket.emit('game:answer', currentQuestion.id, answerIndex);
  };

  const currentPlayer = players.find((p) => p.id === currentPlayerId);

  if (isFinished) {
    return (
      <div className="game-container">
        <div className="game-finished">
          <h2>🎉 Game Finished!</h2>
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
        </div>

        <style jsx>{`
          .game-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }

          .game-finished {
            background: var(--card-bg);
            border-radius: 8px;
            padding: 2rem;
            box-shadow: 0 2px 10px var(--shadow);
            text-align: center;
            transition: background-color 0.3s ease;
          }

          .game-finished h2 {
            color: var(--text-primary);
            margin-bottom: 2rem;
          }

          .final-scores h3 {
            margin-bottom: 1rem;
            color: var(--text-secondary);
          }

          .score-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            margin-bottom: 0.5rem;
            background: var(--card-hover);
            border-radius: 4px;
            border: 1px solid var(--border);
          }

          .rank {
            font-weight: bold;
            font-size: 1.2rem;
            color: var(--primary);
            min-width: 40px;
          }

          .nickname {
            flex: 1;
            text-align: left;
            margin-left: 1rem;
            color: var(--text-primary);
          }

          .score {
            font-weight: 600;
            color: var(--success);
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
        <div className="timer">⏱️ {timeLeft}s</div>
        <div className="score">Your Score: {currentPlayer?.score || 0}</div>
      </div>

      {currentQuestion && (
        <div className="question-card">
          <h2 className="question-text">{currentQuestion.question}</h2>
          <div className="question-meta">
            <span className="category">{currentQuestion.category}</span>
            <span className="difficulty">{currentQuestion.difficulty}</span>
          </div>

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
                  {showCorrect && isCorrect && ' ✓'}
                  {showCorrect && isSelected && !isCorrect && ' ✗'}
                </button>
              );
            })}
          </div>

          {answerResult && (
            <div className={`result ${answerResult.correct ? 'correct-result' : 'incorrect-result'}`}>
              {answerResult.correct ? '🎉 Correct! +10 points' : '❌ Incorrect'}
            </div>
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
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--card-bg);
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          box-shadow: 0 2px 10px var(--shadow);
          transition: background-color 0.3s ease;
        }

        .question-info,
        .timer,
        .score {
          font-weight: 600;
          color: var(--text-primary);
        }

        .timer {
          font-size: 1.2rem;
          color: ${timeLeft <= 5 ? 'var(--timer-warning)' : 'var(--text-primary)'};
        }

        .question-card {
          background: var(--card-bg);
          padding: 2rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          box-shadow: 0 2px 10px var(--shadow);
          transition: background-color 0.3s ease;
        }

        .question-text {
          color: var(--text-primary);
          margin-bottom: 1rem;
          font-size: 1.5rem;
        }

        .question-meta {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .category,
        .difficulty {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .category {
          background: var(--info);
          color: var(--info-text);
        }

        .difficulty {
          background: var(--warning);
          color: white;
        }

        .answers {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
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
        }

        .answer-btn:hover:not(:disabled) {
          border-color: var(--primary);
          background: var(--info);
        }

        .answer-btn:disabled {
          cursor: not-allowed;
        }

        .answer-btn.selected {
          border-color: var(--primary);
          background: var(--info);
        }

        .answer-btn.correct {
          border-color: var(--success);
          background: var(--success-light);
          color: white;
        }

        .answer-btn.incorrect {
          border-color: var(--danger);
          background: var(--danger-light);
          color: white;
        }

        .result {
          padding: 1rem;
          border-radius: 4px;
          text-align: center;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .correct-result {
          background: var(--success-light);
          color: white;
        }

        .incorrect-result {
          background: var(--danger-light);
          color: white;
        }

        .scoreboard {
          background: var(--card-bg);
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 10px var(--shadow);
          transition: background-color 0.3s ease;
        }

        .scoreboard h3 {
          margin-bottom: 1rem;
          color: var(--text-primary);
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
          border-radius: 4px;
          border: 1px solid var(--border);
        }

        .player-name {
          color: var(--text-primary);
        }

        .player-score {
          font-weight: 600;
          color: var(--success);
        }
      `}</style>
    </div>
  );
}
