'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSocket } from '@/components/SocketProvider';
import { GameState, Prompt, Player } from '@/lib/types';
import { PartyPopper, Pause, ArrowRight, Clock, Star, Loader } from 'lucide-react';
import logger from '@/lib/logger';

export default function GamePage() {
  const socket = useSocket();
  const router = useRouter();
  const params = useParams();
  const lobbyId = params.lobbyId as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | undefined>();
  const [hostId, setHostId] = useState<string | undefined>();
  const [timedMode, setTimedMode] = useState(true);
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);
  const [roundNumber, setRoundNumber] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15000);
  const TOTAL_TIME = 15000; // 15 seconds in milliseconds
  const [isFinished, setIsFinished] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewPromptIndex, setReviewPromptIndex] = useState(0);
  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [playerAnswers, setPlayerAnswers] = useState<{ [promptId: string]: { [playerId: string]: string } }>({});
  const [isGrading, setIsGrading] = useState(false);
  const [gradedAnswers, setGradedAnswers] = useState<{ [promptId: string]: Array<{ playerId: string; nickname: string; answer: string; score: number; reasoning: string }> }>({});
  const [finalScores, setFinalScores] = useState<{ playerId: string; nickname: string; score: number }[]>([]);
  const [answeredPlayers, setAnsweredPlayers] = useState<Set<string>>(new Set());
  const [showSkipConfirmation, setShowSkipConfirmation] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);

  // Initial data fetch - only runs once when component mounts
  useEffect(() => {
    if (!socket) return;

    socket.emit('game:get', lobbyId);
    socket.emit('lobby:get', lobbyId);
  }, [socket, lobbyId]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleLobbyData = (lobby: any, players: Player[]) => {
      setHostId(lobby.hostId);
      setTimedMode(lobby.timedMode ?? true);
    };

    const handleGameData = (game: GameState) => {
      setPlayers(game.players);
      setTotalRounds(game.prompts.length);
      
      const myPlayer = game.players.find(p => p.socketId === socket.id);
      if (myPlayer) {
        setCurrentPlayerId(myPlayer.id);
      }
    };

    const handleGamePrompt = (prompt: Prompt, roundNum: number, total: number) => {
      setCurrentPrompt(prompt);
      setRoundNumber(roundNum);
      setTotalRounds(total);
      setUserAnswer('');
      setHasAnswered(false);
      setTimeLeft(15000);
      setAnsweredPlayers(new Set()); // Reset answered players for new prompt
    };

    const handleRoundEnd = (scores: { playerId: string; score: number }[]) => {
      setPlayers(prevPlayers => 
        prevPlayers.map(player => {
          const updatedScore = scores.find(s => s.playerId === player.id);
          return updatedScore ? { ...player, score: updatedScore.score } : player;
        })
      );
    };

    const handleGameFinished = (scores: { playerId: string; nickname: string; score: number }[]) => {
      setIsFinished(true);
      setFinalScores(scores);
    };

    const handleGameStarted = (game: GameState) => {
      setPlayers(game.players);
      setTotalRounds(game.prompts.length);
      setAllPrompts(game.prompts);
      
      const myPlayer = game.players.find(p => p.socketId === socket.id);
      if (myPlayer) {
        setCurrentPlayerId(myPlayer.id);
      }
    };

    const handleGameAnswer = (promptId: string, playerId: string, answer: string) => {
      setPlayerAnswers(prev => ({
        ...prev,
        [promptId]: {
          ...(prev[promptId] || {}),
          [playerId]: answer
        }
      }));
    };

    const handlePlayerAnswered = (playerId: string) => {
      setAnsweredPlayers(prev => new Set(prev).add(playerId));
    };

    const handleReviewStart = (prompts: Prompt[], answers: { [promptId: string]: { [playerId: string]: string } }) => {
      setIsReviewing(true);
      setAllPrompts(prompts);
      setPlayerAnswers(answers);
      setReviewPromptIndex(0);
      setIsGrading(true);
      // Host triggers grading of first prompt
      if (hostId === currentPlayerId || socket.id === hostId) {
        socket.emit('game:grade-prompt', 0);
      }
    };

    const handleReviewNextPrompt = (nextIndex: number) => {
      setReviewPromptIndex(nextIndex);
      setIsGrading(true);
      // Host triggers grading of next prompt
      if (hostId === currentPlayerId || socket.id === hostId) {
        socket.emit('game:grade-prompt', nextIndex);
      }
    };

    const handleGradesReady = (promptIndex: number, gradedAnswers: Array<{ playerId: string; nickname: string; answer: string; score: number; reasoning: string }> ) => {
      const prompt = allPrompts[promptIndex];
      if (!prompt) return;

      setGradedAnswers(prev => ({
        ...prev,
        [prompt.id]: gradedAnswers
      }));
      setIsGrading(false);
      setRevealedCount(0); // Reset reveal count for new prompt

      // Update player scores with the grades from this prompt
      setPlayers(prevPlayers => 
        prevPlayers.map(player => {
          const graded = gradedAnswers.find(g => g.playerId === player.id);
          if (graded) {
            const newScore = player.score + graded.score;
            logger.info({ 
              event: 'player_score_updated', 
              playerId: player.id, 
              nickname: player.nickname, 
              previousScore: player.score, 
              addedScore: graded.score,
              newScore 
            }, 'Updated player score');
            return { ...player, score: newScore };
          }
          return player;
        })
      );

      logger.info({ event: 'grades_received', promptIndex, resultsCount: gradedAnswers.length }, 'Received grading results');
    };

    const handleFinishReview = () => {
      logger.info({ 
        event: 'finish_review_received', 
        currentPlayerId, 
        hostId, 
        socketId: socket.id,
        isHost: hostId === currentPlayerId || socket.id === hostId 
      }, 'Received game:finish-review event');
      
      // Only non-hosts should handle this event
      if (hostId !== currentPlayerId && socket.id !== hostId) {
        logger.info({ event: 'finish_review_processing', currentPlayers: players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score })) }, 'Non-host processing finish review');
        setIsReviewing(false);
        const scores = [...players]
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map(p => ({ playerId: p.id, nickname: p.nickname, score: p.score || 0 }));
        logger.info({ event: 'non_host_final_scores', scores }, 'Non-host computed final scores');
        setFinalScores(scores);
        setIsFinished(true);
      } else {
        logger.info({ event: 'finish_review_skipped' }, 'Host skipping finish review handler (already handled locally)');
      }
    };

    socket.on('lobby:data', handleLobbyData);
    socket.on('game:data', handleGameData);
    socket.on('game:started', handleGameStarted);
    socket.on('game:prompt', handleGamePrompt);
    socket.on('game:round-end', handleRoundEnd);
    socket.on('game:answer', handleGameAnswer);
    socket.on('game:player-answered', handlePlayerAnswered);
    socket.on('game:review-start', handleReviewStart);
    socket.on('game:review-next-prompt', handleReviewNextPrompt);
    socket.on('game:grades-ready', handleGradesReady);
    socket.on('game:finish-review', handleFinishReview);
    socket.on('game:finished', handleGameFinished);

    return () => {
      socket.off('lobby:data', handleLobbyData);
      socket.off('game:data', handleGameData);
      socket.off('game:started', handleGameStarted);
      socket.off('game:prompt', handleGamePrompt);
      socket.off('game:round-end', handleRoundEnd);
      socket.off('game:answer', handleGameAnswer);
      socket.off('game:player-answered', handlePlayerAnswered);
      socket.off('game:review-start', handleReviewStart);
      socket.off('game:review-next-prompt', handleReviewNextPrompt);
      socket.off('game:grades-ready', handleGradesReady);
      socket.off('game:finish-review', handleFinishReview);
      socket.off('game:finished', handleGameFinished);
    };
  }, [socket, lobbyId, hostId, currentPlayerId, allPrompts, players]);

  // Auto-close skip confirmation modal if all players answered
  useEffect(() => {
    if (showSkipConfirmation && players.length > 0 && answeredPlayers.size === players.length) {
      setShowSkipConfirmation(false);
    }
  }, [showSkipConfirmation, answeredPlayers, players]);

  // Timer countdown
  useEffect(() => {
    if (!timedMode || timeLeft <= 0 || !currentPrompt || hasAnswered) return;

    const timer = setTimeout(() => {
      setTimeLeft(Math.max(0, timeLeft - 50));
    }, 50);

    return () => clearTimeout(timer);
  }, [timeLeft, currentPrompt, timedMode, hasAnswered]);

  // Suspenseful reveal effect for graded answers
  useEffect(() => {
    if (!isReviewing || isGrading || !allPrompts.length) return;
    
    const currentReviewPrompt = allPrompts[reviewPromptIndex];
    const currentGradedAnswers = gradedAnswers[currentReviewPrompt?.id] || [];
    
    if (currentGradedAnswers.length === 0 || revealedCount >= currentGradedAnswers.length) return;

    const timer = setTimeout(() => {
      setRevealedCount(prev => prev + 1);
    }, 2250); // Reveal one answer per second

    return () => clearTimeout(timer);
  }, [isReviewing, isGrading, allPrompts, reviewPromptIndex, gradedAnswers, revealedCount]);

  const handleSubmitAnswer = () => {
    if (!socket || !currentPrompt || !userAnswer.trim()) return;

    setHasAnswered(true);
    // Remove newlines and replace with spaces to prevent display issues
    const sanitizedAnswer = userAnswer.trim().replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
    socket.emit('game:answer', currentPrompt.id, sanitizedAnswer);
  };

  const handleNextRound = () => {
    if (!socket || hostId !== currentPlayerId) return;
    
    // Check if there are unanswered players
    const unansweredPlayers = players.filter(p => !answeredPlayers.has(p.id));
    
    if (unansweredPlayers.length > 0) {
      // Show confirmation modal
      setShowSkipConfirmation(true);
    } else {
      // No unanswered players, proceed immediately
      socket.emit('game:next-round');
    }
  };

  const handleConfirmSkip = () => {
    if (!socket) return;
    socket.emit('game:next-round');
    setShowSkipConfirmation(false);
  };

  const handleNextReviewPrompt = () => {
    if (!socket || hostId !== currentPlayerId) return;
    
    if (reviewPromptIndex < allPrompts.length - 1) {
      const nextIndex = reviewPromptIndex + 1;
      // Emit event to sync all players
      socket.emit('game:review-next-prompt', nextIndex);
    } else {
      // All prompts reviewed, finish game
      socket.emit('game:finish-review');
    }
  };

  // Locally finish review and show scores (host-only local view)
  const handleLocalFinishAndShowScores = () => {
    if (!socket) return;
    
    // Emit event to notify other players
    logger.info({ event: 'emitting_finish_review', lobbyId }, 'Host emitting game:finish-review');
    socket.emit('game:finish-review');
    
    // stop review UI so finished view is shown
    logger.info({ event: 'building_final_scores', currentPlayers: players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score })) }, 'Building final scores from current players');
    console.log('Locally finishing review and showing final scores');
    setIsReviewing(false);
    // build finalScores from current players (sorted desc)
    const scores = [...players]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map(p => ({ playerId: p.id, nickname: p.nickname, score: p.score || 0 }));
    logger.info({ event: 'final_scores_built', scores }, 'Final scores computed');
    setFinalScores(scores);
    setIsFinished(true);
  };

  const handleReturnHome = () => {
    if (socket) {
      socket.emit('lobby:leave');
    }
    router.push('/');
  };

  const currentPlayer = players.find((p) => p.id === currentPlayerId);

  // Get score color class based on score value
  const getScoreColorClass = (score: number): string => {
    if (score >= 80) return 'score-green';
    if (score >= 60) return 'score-blue';
    if (score >= 40) return 'score-yellow';
    return 'score-red';
  };

  if (!socket) {
    return (
      <div className="loading">
        <p>Connecting to server...</p>
      </div>
    );
  }

  if (isReviewing && allPrompts.length > 0) {
    const currentReviewPrompt = allPrompts[reviewPromptIndex];
    const currentGradedAnswers = gradedAnswers[currentReviewPrompt.id] || [];
    // Sort by score descending (best to worst) for display, reveal from bottom to top
    const sortedGradedAnswers = [...currentGradedAnswers].sort((a, b) => b.score - a.score);

    return (
      <div className="game-container">
        <div className="review-container">
          <div className="review-header">
            <h2>Review & Grade</h2>
            <div className="review-progress">
              Prompt {reviewPromptIndex + 1} of {allPrompts.length}
            </div>
          </div>

          <div className="review-prompt-card">
            <h3 className="review-prompt-text">{currentReviewPrompt.text}</h3>
            
            <div className="review-answers">
              {isGrading ? (
                <div className="grading-status">
                  <Loader className="spinner" size={24} />
                  <p>AI is grading answers...</p>
                </div>
              ) : sortedGradedAnswers.length > 0 ? (
                <>
                  <h4>AI Graded Answers:</h4>
                  <div className="answers-list">
                    {sortedGradedAnswers.map((item, index) => {
                      // Reveal from bottom to top: last items (worst scores) reveal first
                      const isRevealed = index >= (sortedGradedAnswers.length - revealedCount);
                      return (
                        <div key={index} className={`graded-answer-item ${!isRevealed ? 'blurred' : 'revealed'}`}>
                        <div className="answer-header">
                          <span className="answer-nickname">
                            {(() => {
                              const name = players.find(p => p.id === item.playerId)?.nickname || item.playerId;
                              return name.charAt(0).toUpperCase() + name.slice(1);
                            })()}:
                          </span>
                          <span className="answer-text">{item.answer}</span>
                          <span className={`answer-score ${getScoreColorClass(item.score)}`}>{item.score}/100</span>
                        </div>
                        <p className="answer-reasoning">{item.reasoning}</p>
                      </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="grading-status">
                  <p>No grading results available</p>
                </div>
              )}
            </div>

            {hostId === currentPlayerId && !isGrading && (
              <button
                  onClick={reviewPromptIndex < allPrompts.length - 1 ? handleNextReviewPrompt : handleLocalFinishAndShowScores}
                  className="btn-next-review"
                >
                  {reviewPromptIndex < allPrompts.length - 1 ? (
                    <>
                      Next Prompt <ArrowRight className="inline-icon-sm" />
                    </>
                  ) : (
                    <>
                      Finish & Show Scores <ArrowRight className="inline-icon-sm" />
                    </>
                  )}
                </button>
            )}

            {hostId === currentPlayerId && isGrading && (
              <button className="btn-next-review" disabled>
                <Loader className="inline-icon-sm spinner" size={16} />
                Grading in progress...
              </button>
            )}
          </div>
        </div>

        <style jsx>{`
          .game-container {
            min-height: 100vh;
            padding: 2rem;
            background: var(--bg-primary);
          }

          .review-container {
            max-width: 900px;
            margin: 0 auto;
          }

          .review-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            flex-wrap: wrap;
            gap: 1rem;
          }

          .review-header h2 {
            color: var(--text-primary);
            margin: 0;
          }

          .review-progress {
            padding: 0.5rem 1rem;
            background: var(--card-bg);
            border-radius: 6px;
            color: var(--text-secondary);
            font-weight: 600;
          }

          .review-prompt-card {
            background: var(--card-bg);
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 20px var(--shadow);
          }

          .review-prompt-text {
            color: var(--text-primary);
            margin-bottom: 2rem;
            font-size: 1.5rem;
            text-align: center;
          }

          .review-answers {
            margin-bottom: 2rem;
          }

          .review-answers h4 {
            color: var(--text-secondary);
            margin-bottom: 1rem;
            font-size: 1.1rem;
          }

          .grading-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            padding: 2rem;
            background: var(--card-hover);
            border-radius: 8px;
            border: 1px solid var(--border);
            color: var(--text-secondary);
            min-height: 120px;
          }

          .spinner {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          .answers-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 0.5rem;
            align-items: start;
          }

          .graded-answer-item {
            padding: 0.6rem 0.7rem;
            background: var(--card-hover);
            border-radius: 6px;
            border: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
            transition: filter 0.5s ease, transform 0.5s ease;
          }

          .graded-answer-item.blurred {
            filter: blur(8px);
            opacity: 0.5;
            pointer-events: none;
          }

          .graded-answer-item.revealed {
            filter: blur(0);
            opacity: 1;
            animation: revealPop 0.5s ease-out;
          }

          @keyframes revealPop {
            0% {
              transform: scale(0.95);
              opacity: 0.5;
            }
            50% {
              transform: scale(1.02);
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }

          .answer-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 0.5rem;
            margin-bottom: 0.25rem;
          }

          .answer-nickname {
            font-weight: 600;
            margin-right: 0.5rem;
            color: var(--primary);
            flex-shrink: 0;
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 0.95rem;
          }

          .answer-text {
            color: var(--text-primary);
            word-break: break-word;
            flex: 1 1 auto;
            margin: 0 0.5rem 0 0.25rem;
            font-size: 0.95rem;
            overflow: visible;
            text-overflow: clip;
            white-space: normal;
            display: block;
          }

          .answer-score {
            font-weight: 700;
            color: white;
            padding: 0.18rem 0.6rem;
            border-radius: 4px;
            font-size: 0.85rem;
            flex-shrink: 0;
          }

          .score-green { background: #22c55e; }
          .score-blue { background: #3b82f6; }
          .score-yellow { background: #eab308; }
          .score-red { background: #ef4444; }

          .answer-reasoning {
            color: var(--text-secondary);
            font-size: 0.85rem;
            margin: 0;
            font-style: italic;
            line-height: 1.2;
            max-height: 3.6rem;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* Large screens: force a 3-up layout so cards use horizontal space */
          @media (min-width: 1100px) {
            .answers-list {
              grid-template-columns: repeat(3, minmax(260px, 1fr));
              gap: 0.6rem;
            }

            .graded-answer-item {
              padding: 0.5rem 0.6rem;
            }
          }

          .btn-next-review {
            width: 100%;
            padding: 1rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }

          .btn-next-review:hover:not(:disabled) {
            background: var(--primary-hover);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px var(--shadow-hover);
          }

          .btn-next-review:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          .inline-icon-sm {
            display: inline-block;
          }

          @media (max-width: 768px) {
            .game-container {
              padding: 1rem;
            }

            .review-header {
              flex-direction: column;
              align-items: flex-start;
            }

            .review-prompt-card {
              padding: 1.5rem 1rem;
            }

            .review-prompt-text {
              font-size: 1.2rem;
            }

            .answer-header {
              flex-direction: row;
              align-items: center;
              gap: 0.35rem;
            }

            .answer-nickname {
              max-width: 90px;
            }

            .answer-text {
              white-space: normal;
              overflow: visible;
              text-overflow: clip;
              display: block;
            }

            .answer-score {
              flex-shrink: 0;
              margin-left: 0.35rem;
            }

            .grading-status {
              flex-direction: column;
              min-height: 100px;
            }
          }
        `}</style>
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
      {showSkipConfirmation && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Skip Unanswered Players?</h2>
            <p className="modal-subtitle">
              The following players haven't answered yet:
            </p>
            <div className="unanswered-list">
              {players
                .filter(p => !answeredPlayers.has(p.id))
                .map(player => (
                  <div key={player.id} className="unanswered-item">
                    {player.nickname}
                  </div>
                ))}
            </div>
            <p className="skip-warning">Are you sure you want to skip to the next prompt?</p>
            <div className="modal-actions">
              <button onClick={() => setShowSkipConfirmation(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleConfirmSkip} className="btn-confirm">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="game-header">
        <div className="question-info">
          Round {roundNumber} of {totalRounds}
        </div>
        {/* {timedMode ? (
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
        )} */}
        {/* <div className="score">Your Score: {currentPlayer?.score || 0}</div> */}
      </div>

        <div className="player-status-board">
        <h3>Player Status</h3>
        <div className="players-list">
          {players.map((player) => {
            const hasAnswered = answeredPlayers.has(player.id);
            return (
              <div key={player.id} className={`player-item ${currentPrompt ? (hasAnswered ? 'answered' : 'thinking') : ''}`}>
                <span className="player-name">
                  {player.nickname}
                  {player.id === currentPlayerId && ' (You)'}
                </span>
                {hasAnswered && <span className="check-icon">✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {currentPrompt && (
        <div className="prompt-card">
          <h2 className="prompt-text">{currentPrompt.text}</h2>

          <div className="answer-section">
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Enter your answer..."
              disabled={hasAnswered}
              maxLength={200}
              rows={3}
            />
            <span className="char-count">{userAnswer.length}/200</span>
          </div>

          <button
            onClick={handleSubmitAnswer}
            disabled={hasAnswered || !userAnswer.trim()}
            className="submit-btn"
          >
            Submit Answer
          </button>

          {!timedMode && hostId === currentPlayerId && hasAnswered && (
            <button onClick={handleNextRound} className="next-round-btn">
              Next Round <ArrowRight className="inline-icon-sm" />
            </button>
          )}
        </div>
      )}



      <style jsx>{`
        .game-container {
          min-height: 100vh;
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
          max-width: 800px;
          margin: 0 auto 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .question-info {
          padding: 0.5rem 1rem;
          background: var(--card-bg);
          border-radius: 6px;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .timer-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .timer {
          font-size: 1.5rem;
          font-weight: bold;
          color: var(--primary);
          padding: 0.5rem 1rem;
          background: var(--card-bg);
          border-radius: 6px;
          min-width: 100px;
          text-align: center;
        }

        .timer-bar-container {
          width: 100px;
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          overflow: hidden;
        }

        .timer-bar {
          height: 100%;
          background: var(--primary);
          transition: width 0.05s linear;
        }

        .score {
          padding: 0.5rem 1rem;
          background: var(--success-light);
          color: var(--success);
          border-radius: 6px;
          font-weight: 600;
        }

        .timeless-mode-indicator {
          padding: 0.5rem 1rem;
          background: var(--card-bg);
          border-radius: 6px;
        }

        .mode-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .prompt-card {
          max-width: 800px;
          margin: 0 auto 2rem;
          background: var(--card-bg);
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 20px var(--shadow);
          margin-top: 1rem;
        }

        .prompt-text {
          color: var(--text-primary);
          margin-bottom: 1.6rem;
          font-size: 1.5rem;
          text-align: center;
        }

        .answer-section {
          position: relative;
          margin-bottom: 1rem;
        }

        textarea {
          width: 100%;
          padding: 1rem;
          border: 2px solid var(--border);
          border-radius: 8px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-family: inherit;
          font-size: 1rem;
          resize: vertical;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        textarea:focus {
          outline: none;
          border-color: var(--primary);
        }

        textarea:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .char-count {
          display: block;
          margin-top: 0.4rem;
          font-size: 0.85rem;
          color: var(--text-tertiary);
          text-align: right;
        }

        .submit-btn {
          width: 100%;
          padding: 1rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          background: var(--primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--shadow-hover);
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .next-round-btn {
          width: 100%;
          padding: 0.75rem;
          margin-top: 0.5rem;
          background: var(--success);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .next-round-btn:hover {
          background: var(--success-hover);
        }

        .player-status-board {
          max-width: 800px;
          margin: 0 auto;
          background: var(--card-bg);
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 20px var(--shadow);
        }

        .player-status-board h3 {
          margin-bottom: 1rem;
          color: var(--text-primary);
          text-align: center;
        }

        .players-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .player-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.7rem;
          background: var(--card-hover);
          border-radius: 6px;
          border: 1px solid var(--border);
          transition: background-color 0.3s ease;
        }

        .player-item.thinking {
          background: var(--bg-primary);
        }

        .player-item.answered {
          background: var(--primary);
        }

        .player-name {
          flex: 1;
          color: var(--text-primary);
          font-size: 0.9rem;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .check-icon {
          color: white;
          font-size: 1.1rem;
          font-weight: bold;
          flex-shrink: 0;
        }

        .inline-icon-sm {
          display: inline-block;
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
          border-radius: 12px;
          box-shadow: 0 4px 20px var(--shadow-hover);
          max-width: 450px;
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

        .modal h2 {
          margin: 0 0 0.5rem 0;
          text-align: center;
          color: var(--text-primary);
          font-size: 1.3rem;
        }

        .modal-subtitle {
          text-align: center;
          color: var(--text-secondary);
          margin: 0 0 1rem 0;
          font-size: 0.95rem;
        }

        .unanswered-list {
          background: var(--bg-secondary);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
          max-height: 150px;
          overflow-y: auto;
        }

        .unanswered-item {
          padding: 0.5rem 0.75rem;
          margin-bottom: 0.5rem;
          background: var(--card-hover);
          border-radius: 4px;
          border-left: 3px solid #eab308;
          color: var(--text-primary);
          font-size: 0.95rem;
        }

        .unanswered-item:last-child {
          margin-bottom: 0;
        }

        .skip-warning {
          text-align: center;
          color: #eab308;
          font-weight: 600;
          margin: 0 0 1.5rem 0;
          font-size: 0.95rem;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
        }

        .btn-cancel {
          flex: 1;
          padding: 0.75rem;
          border: 2px solid var(--border);
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 1rem;
        }

        .btn-cancel:hover {
          background: var(--card-hover);
          border-color: var(--text-secondary);
        }

        .btn-confirm {
          flex: 1;
          padding: 0.75rem;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--primary);
          color: white;
          font-size: 1rem;
        }

        .btn-confirm:hover {
          background: var(--primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px var(--shadow-hover);
        }

        @media (max-width: 768px) {
          .game-container {
            padding: 1rem;
          }

          .game-header {
            margin-bottom: 1rem;
          }

          .prompt-card {
            padding: 1.5rem 1rem;
            margin-top: 1rem;
          }

          .prompt-text {
            font-size: 1.2rem;
            margin-bottom: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
