'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Mock data
const mockQuestion = {
  question: "What is the capital of France?",
  options: [
    "London",
    "Berlin", 
    "Paris",
    "Madrid"
  ],
  correctAnswer: 2,
  category: "Geography",
  difficulty: "easy"
};

const mockPlayers = [
  { id: '1', nickname: 'You', score: 30, ready: true },
  { id: '2', nickname: 'Player2', score: 20, ready: true },
  { id: '3', nickname: 'Player3', score: 10, ready: true }
];

export default function DebugGamePage() {
  const router = useRouter();
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; correctAnswer: number } | null>(null);
  const [timeLeft] = useState(8000); // 8 seconds out of 10
  const currentPlayerId = '1';
  const questionNumber = 3;
  const totalQuestions = 10;
  const TOTAL_TIME = 10000;

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    
    setSelectedAnswer(index);
    const isCorrect = index === mockQuestion.correctAnswer;
    setAnswerResult({
      correct: isCorrect,
      correctAnswer: mockQuestion.correctAnswer
    });
  };

  const handleReturnHome = () => {
    router.push('/');
  };

  const currentPlayer = mockPlayers.find(p => p.id === currentPlayerId);

  return (
    <div className="game-container">
      <div className="debug-banner">
        🐛 DEBUG MODE - Mock Game Data
      </div>

      <div className="game-header">
        <div className="question-info">
          Question {questionNumber} of {totalQuestions}
        </div>
        <div className="timer-container">
          <div className="timer">{(timeLeft / 1000).toFixed(2)}s</div>
          <div className="timer-bar-container">
            <div 
              className="timer-bar" 
              style={{ width: `${(timeLeft / TOTAL_TIME) * 100}%` }}
            />
          </div>
        </div>
        <div className="score">Your Score: {currentPlayer?.score || 0}</div>
      </div>

      <div className="question-card">
        <h2 className="question-text">{mockQuestion.question}</h2>


        <div className="answers">
          {mockQuestion.options.map((option, index) => {
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

      <div className="scoreboard">
        <h3>Live Scores</h3>
        <div className="scores-list">
          {mockPlayers
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
        .debug-banner {
          background: var(--warning);
          color: white;
          text-align: center;
          padding: 0.75rem;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .game-container {
          min-height: 100vh;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem;
          background: var(--bg-primary);
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
          font-size: 1.5rem;
          line-height: 1.4;
          margin: 0;
          margin-bottom: 1rem;
        }

        .question-meta {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
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

          .debug-banner {
            border-radius: 0;
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
            margin-bottom: 1rem;
          }

          .answers {
            grid-template-columns: 1fr;
            gap: 0.75rem;
            margin-bottom: 1rem;
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
        }
      `}</style>
    </div>
  );
}
