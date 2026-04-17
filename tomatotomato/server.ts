import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger from './src/lib/logger.js';

// Enhanced user fingerprinting combining multiple factors (no IP for privacy)
function fingerprintUser(
  userAgent: string | undefined,
  acceptLanguage?: string | undefined,
  platform?: string | undefined
): string {
  if (!userAgent) return 'unknown';
  
  const normalizedUA = userAgent || 'no-ua';
  const normalizedLang = acceptLanguage?.split(',')[0]?.trim() || 'no-lang';
  const normalizedPlatform = platform || 'no-platform';
  
  // Combine factors for fingerprint (excluding IP for privacy)
  const fingerprintString = `${normalizedUA}|${normalizedLang}|${normalizedPlatform}`;
  
  // Create a hash for privacy
  return crypto.createHash('sha256').update(fingerprintString).digest('hex').substring(0, 16);
}

// Import types and game state - using relative paths for tsx compatibility
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  Player,
  GameState,
  Prompt,
} from './src/lib/types.js';
import { gameState } from './src/lib/gameState.js';
import { generatePrompts, gradeAnswers } from './src/lib/questionGenerator.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = parseInt(process.env.PORT || '3003', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Function to fetch prompts using AWS Bedrock (for Apples to Apples style game)
async function fetchPromptsFromAPI(
  difficulty: 'easy' | 'medium' | 'hard',
  theme?: string,
  count: number = 10,
  userFingerprint?: string
): Promise<Prompt[]> {
  try {
    logger.info({ 
      event: 'prompts_requested',
      difficulty, 
      theme: theme || 'general', 
      count,
      userFingerprint: userFingerprint || 'unknown'
    }, 'Fetching prompts from Bedrock');
    
    // Generate Apples to Apples style prompts using the new prompt generator
    const generatedPrompts = await generatePrompts({
      theme: theme || 'general knowledge',
      difficulty,
      count,
    });

    // Transform to Prompt format with IDs and category
    return generatedPrompts.map(p => ({
      id: uuidv4(),
      text: p,
      category: theme || 'General',
    }));
  } catch (error) {
    logger.error({ 
      error, 
      difficulty, 
      theme,
      userFingerprint: userFingerprint || 'unknown'
    }, 'Error fetching prompts from Bedrock, falling back to mock');
    // Fallback to mock prompts on error
    return MOCK_PROMPTS.map((p) => ({
      ...p,
      id: uuidv4(),
      category: theme || p.category,
    }));
  }
}

// Mock prompts (fallback)
const MOCK_PROMPTS: Prompt[] = [
  {
    id: '1',
    text: 'Things you find in a library',
    category: 'General',
  },
  {
    id: '2',
    text: 'Breakfast foods',
    category: 'Food',
  },
  {
    id: '3',
    text: 'Things that are cold',
    category: 'General',
  },
];

app.prepare().then(() => {
  logger.info('Next.js application prepared');
  
  // Create HTTP server without request handler
  const server = createServer(async (req, res) => {
    try {
      // Handle grading API endpoint
      if (req.url?.startsWith('/api/grade-answers') && req.method === 'POST') {
        let body = '';
        
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        
        req.on('end', async () => {
          try {
            const { prompt, answers } = JSON.parse(body);
            
            logger.info({ 
              event: 'grade_request',
              prompt,
              answerCount: answers.length
            }, 'Grading answers');
            
            // Call the grader
            const gradedAnswers = await gradeAnswers({
              prompt,
              answers
            });
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ gradedAnswers }));
            
            logger.info({
              event: 'grading_complete',
              answerCount: answers.length,
              resultsCount: gradedAnswers.length
            }, 'Grading completed');
          } catch (error) {
            logger.error({ error, body }, 'Error grading answers');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to grade answers' }));
          }
        });
        
        return;
      }
      
      // Check if this is a Socket.IO request - if so, don't handle it here
      // Socket.IO will handle its own requests through the engine.io middleware
      if (!req.url?.startsWith('/api/socket')) {
        const parsedUrl = parse(req.url!, true);
        
        // Log ref parameter for CloudWatch grouping if present on main page
        if (parsedUrl.query?.ref && parsedUrl.pathname === '/') {
          const ref = parsedUrl.query.ref;
          logger.info({
            event: 'page_visit_with_ref',
            ref: ref,
            url: req.url,
            userAgent: req.headers['user-agent'],
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          }, `Page visited with ref: ${ref}`);
        }
        
        await handle(req, res, parsedUrl);
      }
    } catch (err) {
      logger.error({ err, url: req.url }, 'Error handling HTTP request');
      res.statusCode = 500;
      res.end('internal server error');
    }
  });
  
  // Attach Socket.io to the same server after server creation
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: dev ? 'http://localhost:3003' : ['https://tomatotomato.degrand.is', 'https://degrand.is'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
  });

  logger.info({ path: '/api/socket' }, 'Socket.IO server initialized');

  io.on('connection', (socket) => {
    // Extract client information for fingerprinting
    const clientIp = socket.handshake.headers['x-forwarded-for'] || 
                     socket.handshake.headers['x-real-ip'] || 
                     socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'];
    const acceptLanguage = socket.handshake.headers['accept-language'];
    // Modern browsers send platform via User-Agent Client Hints
    const platformHeader = socket.handshake.headers['sec-ch-ua-platform'];
    const platform = (Array.isArray(platformHeader) ? platformHeader[0] : platformHeader)?.replace(/"/g, '');
    const userFingerprint = fingerprintUser(userAgent, acceptLanguage, platform);
    
    // Capture ref parameter from socket handshake query
    const ref = socket.handshake.query.ref as string | undefined;
    
    logger.info({ 
      event: 'client_connected',
      socketId: socket.id,
      clientIp: Array.isArray(clientIp) ? clientIp[0] : clientIp?.split(',')[0]?.trim(),
      userAgent: userAgent,
      acceptLanguage: acceptLanguage?.split(',')[0],
      platform: platform,
      userFingerprint: userFingerprint,
      ref: ref || 'none'
    }, ref ? `Client connected with ref: ${ref}` : 'Client connected');

    // === LOBBY EVENTS ===

    socket.on('lobby:list', () => {
      socket.emit('lobby:updated', gameState.getAllLobbies());
    });

    socket.on('lobby:get', (lobbyId: string) => {
      try {
        const lobby = gameState.getLobby(lobbyId);
        if (!lobby) {
          socket.emit('lobby:error', 'Lobby not found');
          return;
        }

        // If player is not already in this lobby's socket room, join it
        // This ensures they receive game:started and other room broadcasts
        const socketRooms = Array.from(socket.rooms);
        if (!socketRooms.includes(lobbyId)) {
          logger.debug({ socketId: socket.id, lobbyId, via: 'lobby:get' }, 'Socket joining room');
          socket.join(lobbyId);
        }

        const players = gameState.getPlayersInLobby(lobbyId);
        socket.emit('lobby:data', lobby, players);
        logger.debug({ lobbyId, socketId: socket.id, playerCount: players.length }, 'Sent lobby data');
      } catch (error) {
        logger.error({ error, lobbyId }, 'Error getting lobby');
        socket.emit('lobby:error', 'Failed to get lobby data');
      }
    });

    socket.on('lobby:create', async (options) => {
      try {
        if (!options || !options.nickname || options.nickname.trim().length === 0) {
          socket.emit('lobby:error', 'Nickname is required');
          return;
        }

        if (!options.lobbyName || options.lobbyName.trim().length === 0) {
          socket.emit('lobby:error', 'Lobby name is required');
          return;
        }

        const playerId = uuidv4();
        const lobbyId = uuidv4();

        // Create player
        const player: Player = {
          id: playerId,
          nickname: options.nickname.trim(),
          socketId: socket.id,
          score: 0,
          ready: false,
        };
        gameState.createPlayer(player);

        // Fetch prompts dynamically based on difficulty and theme
        const prompts = await fetchPromptsFromAPI(
          options.difficulty || 'medium',
          options.theme?.trim(),
          options.roundCount || 10,
          userFingerprint
        );
        logger.info({ 
          event: 'prompts_fetched',
          promptCount: prompts.length, 
          difficulty: options.difficulty, 
          theme: options.theme,
          userFingerprint: userFingerprint
        }, 'Prompts fetched successfully');

        // Log each prompt individually for searchability
        prompts.forEach((p, index) => {
          logger.info({
            event: 'prompt_generated',
            lobbyId,
            promptIndex: index,
            promptText: p.text,
            category: p.category,
            difficulty: options.difficulty,
            theme: options.theme,
            userFingerprint: userFingerprint,
          }, 'Prompt generated');
        });

        // Create lobby with new parameters including prompts
        const lobby = gameState.createLobby(
          lobbyId,
          playerId,
          options.lobbyName.trim(),
          options.maxPlayers || 8,
          options.difficulty || 'medium',
          options.theme?.trim(),
          prompts,
          options.timedMode ?? false
        );
        gameState.addPlayerToLobby(playerId, lobbyId);

        // Store player data in socket
        socket.data.playerId = playerId;
        socket.data.nickname = options.nickname.trim();
        socket.data.lobbyId = lobbyId;

        // Join socket room
        socket.join(lobbyId);

        // Send lobby info
        socket.emit('lobby:joined', lobby, [player]);
        io.emit('lobby:updated', gameState.getAllLobbies());

        logger.info({ 
          event: 'lobby_created',
          playerId,
          playerName: options.nickname,
          lobbyId,
          lobbyName: options.lobbyName,
          promptCount: prompts.length,
          difficulty: options.difficulty,
          theme: options.theme,
          userFingerprint: userFingerprint
        }, 'Player created lobby');
      } catch (error) {
        logger.error({ error, nickname: options?.nickname, lobbyName: options?.lobbyName }, 'Error creating lobby');
        socket.emit('lobby:error', 'Failed to create lobby');
      }
    });

    socket.on('lobby:join', (lobbyId, nickname) => {
      try {
        if (!nickname || nickname.trim().length === 0) {
          socket.emit('lobby:error', 'Nickname is required');
          return;
        }

        const lobby = gameState.getLobby(lobbyId);
        if (!lobby) {
          socket.emit('lobby:error', 'Lobby not found');
          return;
        }

        if (lobby.status !== 'waiting') {
          socket.emit('lobby:error', 'Lobby has already started');
          return;
        }

        const playerId = uuidv4();
        const player: Player = {
          id: playerId,
          nickname: nickname.trim(),
          socketId: socket.id,
          score: 0,
          ready: false,
        };

        gameState.createPlayer(player);
        const success = gameState.addPlayerToLobby(playerId, lobbyId);

        if (!success) {
          socket.emit('lobby:error', 'Lobby is full');
          gameState.deletePlayer(playerId);
          return;
        }

        socket.data.playerId = playerId;
        socket.data.nickname = nickname.trim();
        socket.data.lobbyId = lobbyId;

        socket.join(lobbyId);

        const players = gameState.getPlayersInLobby(lobbyId);
        socket.emit('lobby:joined', lobby, players);
        socket.to(lobbyId).emit('lobby:player-joined', player);
        io.emit('lobby:updated', gameState.getAllLobbies());

        logger.info({ event: 'player_joined', playerId, playerName: nickname, lobbyId }, 'Player joined lobby');
      } catch (error) {
        logger.error({ error, nickname, lobbyId }, 'Error joining lobby');
        socket.emit('lobby:error', 'Failed to join lobby');
      }
    });

    socket.on('lobby:leave', () => {
      handlePlayerLeave(socket, io);
    });

    socket.on('lobby:ready', () => {
      const { playerId, lobbyId } = socket.data;
      if (!playerId || !lobbyId) return;

      gameState.updatePlayer(playerId, { ready: true });
      const players = gameState.getPlayersInLobby(lobbyId);
      
      // Broadcast updated player list, not full lobby data
      io.to(lobbyId).emit('lobby:players-updated', players);
    });

    socket.on('lobby:start', () => {
      const { playerId, lobbyId } = socket.data;
      if (!playerId || !lobbyId) return;

      const lobby = gameState.getLobby(lobbyId);
      if (!lobby || lobby.hostId !== playerId) {
        socket.emit('lobby:error', 'Only the host can start the game');
        return;
      }

      const players = gameState.getPlayersInLobby(lobbyId);
      if (players.length < 1) {
        socket.emit('lobby:error', 'Need at least 1 player to start');
        return;
      }

      // Start game
      startGame(io, lobbyId);
    });

    // === GAME EVENTS ===

    socket.on('game:get', (lobbyId: string) => {
      try {
        const game = gameState.getGame(lobbyId);
        if (!game) {
          socket.emit('lobby:error', 'Game not found');
          return;
        }

        // Ensure socket is in the game room
        const socketRooms = Array.from(socket.rooms);
        if (!socketRooms.includes(lobbyId)) {
          logger.debug({ socketId: socket.id, lobbyId, via: 'game:get' }, 'Socket joining game room');
          socket.join(lobbyId);
        }

        socket.emit('game:data', game);
        logger.debug({ lobbyId, socketId: socket.id, promptCount: game.prompts.length }, 'Sent game data');
      } catch (error) {
        logger.error({ error, lobbyId }, 'Error getting game');
        socket.emit('lobby:error', 'Failed to get game data');
      }
    });

    socket.on('game:answer', (promptId, answer) => {
      const { playerId, lobbyId } = socket.data;
      if (!playerId || !lobbyId) return;

      const game = gameState.getGame(lobbyId);
      if (!game || game.status !== 'in-progress') return;

      const prompt = game.prompts.find((p) => p.id === promptId);
      if (!prompt) return;

      // Record the answer
      gameState.recordAnswer(lobbyId, promptId, playerId, answer);

      logger.info({ 
        event: 'player_answered',
        playerId,
        promptId,
        answer
      }, 'Player submitted answer');

      socket.emit('game:answer-result', true);
      
      // Notify all players that this player has answered
      io.to(lobbyId).emit('game:player-answered', playerId);

      // Check if all players have answered all prompts
      const playerIds = gameState.getPlayersInLobby(lobbyId).map(p => p.id);
      const answers = gameState.getAnswers(lobbyId);
      
      const allAnswered = game.prompts.every(prompt => {
        const promptAnswers = answers[prompt.id] || {};
        return playerIds.every(playerId => playerId in promptAnswers);
      });

      // If all answered, start the review phase
      if (allAnswered && !game.isReviewing) {
        logger.info({ event: 'all_answers_collected', lobbyId }, 'All answers collected, starting review phase');
        gameState.updateGame(lobbyId, { isReviewing: true });
        io.to(lobbyId).emit('game:review-start', game.prompts, answers);
      }
    });

    // Manual progression for timeless mode
    socket.on('game:next-round', () => {
      const { lobbyId, playerId } = socket.data;
      if (!lobbyId || !playerId) return;

      const lobby = gameState.getLobby(lobbyId);
      if (!lobby || lobby.hostId !== playerId) {
        // Only host can progress
        return;
      }

      const game = gameState.getGame(lobbyId);
      if (!game || game.status !== 'in-progress') return;

      // Move to next round
      gameState.updateGame(lobbyId, { currentRound: game.currentRound + 1 });
      sendNextRound(io, lobbyId);
    });

    socket.on('game:review-next-prompt', (nextIndex: number) => {
      const { lobbyId, playerId } = socket.data;
      if (!lobbyId || !playerId) return;

      const lobby = gameState.getLobby(lobbyId);
      if (!lobby || lobby.hostId !== playerId) {
        // Only host can advance prompts
        return;
      }

      const game = gameState.getGame(lobbyId);
      if (!game || !game.isReviewing) return;

      // Broadcast to all players in the game
      logger.info({ event: 'review_next_prompt', lobbyId, nextIndex }, 'Host advanced to next prompt');
      io.to(lobbyId).emit('game:review-next-prompt', nextIndex);
    });

    socket.on('game:grade-prompt', async (promptIndex: number) => {
      const { lobbyId, playerId } = socket.data;
      if (!lobbyId || !playerId) return;

      const lobby = gameState.getLobby(lobbyId);
      if (!lobby || lobby.hostId !== playerId) {
        // Only host can trigger grading
        return;
      }

      const game = gameState.getGame(lobbyId);
      if (!game || !game.isReviewing) return;

      const prompt = game.prompts[promptIndex];
      if (!prompt) return;

      const answers = gameState.getAnswers(lobbyId);
      const promptAnswers = answers[prompt.id] || {};
      const answerList = Object.values(promptAnswers);

      if (answerList.length === 0) {
        // No answers to grade
        io.to(lobbyId).emit('game:grades-ready', promptIndex, []);
        return;
      }

      logger.info({ 
        event: 'grading_prompt',
        lobbyId, 
        promptIndex,
        promptText: prompt.text,
        answerCount: answerList.length
      }, 'Grading prompt');

      try {
          // Call the grader
          const gradedAnswersRaw = await gradeAnswers({
            prompt: prompt.text,
            answers: answerList
          });

          // Attach nickname to each graded answer
          const players = gameState.getPlayersInLobby(lobbyId);
          const promptAnswersMap = answers[prompt.id] || {};
          const gradedAnswers = gradedAnswersRaw.map((graded, idx) => {
            // Find playerId for this answer
            const answerText = graded.answer;
            // Find playerId by matching answer text in promptAnswersMap
            const playerId = Object.keys(promptAnswersMap).find(pid => promptAnswersMap[pid] === answerText) || '';
            const player = players.find(p => p.id === playerId);
            return {
              playerId,
              nickname: player ? player.nickname : '',
              answer: graded.answer,
              score: graded.score,
              reasoning: graded.reasoning
            };
          });

          logger.info({
            event: 'grading_complete',
            lobbyId,
            promptIndex,
            answerCount: answerList.length,
            resultsCount: gradedAnswers.length
          }, 'Grading completed');

          // Update player scores on the server
          gradedAnswers.forEach(graded => {
            if (graded.playerId) {
              const player = gameState.getPlayer(graded.playerId);
              if (player) {
                const newScore = player.score + graded.score;
                gameState.updatePlayer(graded.playerId, { score: newScore });
                logger.info({
                  event: 'player_score_updated_server',
                  playerId: graded.playerId,
                  nickname: graded.nickname,
                  previousScore: player.score,
                  addedScore: graded.score,
                  newScore
                }, 'Updated player score on server');
              }
            }
          });

          // Broadcast results to all players in the lobby
          io.to(lobbyId).emit('game:grades-ready', promptIndex, gradedAnswers);
      } catch (error) {
        logger.error({ error, lobbyId, promptIndex }, 'Error grading prompt');
        // Send empty results on error
        io.to(lobbyId).emit('game:grades-ready', promptIndex, []);
      }
    });

    socket.on('game:finish-review', () => {
      const { lobbyId, playerId } = socket.data;
      if (!lobbyId || !playerId) return;
    
      const lobby = gameState.getLobby(lobbyId);
      if (!lobby || lobby.hostId !== playerId) {
        // Only host can finish review
        return;
      }

      const game = gameState.getGame(lobbyId);
      if (!game || !game.isReviewing) return;

      logger.info({ event: 'review_finished', lobbyId }, 'Review phase finished, broadcasting to other players');
      
      // Broadcast to other players in the lobby (excluding the host)
      socket.to(lobbyId).emit('game:finish-review');
      
      logger.info({ event: 'review_finished_ending_game', lobbyId }, 'Ending game');
      endGame(io, lobbyId);
    });

    socket.on('disconnect', () => {
      logger.info({ 
        event: 'client_disconnected',
        socketId: socket.id,
        userFingerprint: userFingerprint
      }, 'Client disconnected');
      handlePlayerLeave(socket, io);
    });
  });

  server.listen(port, () => {
    logger.info({ 
      hostname, 
      port, 
      environment: process.env.NODE_ENV,
      httpUrl: `http://${hostname}:${port}`,
      socketUrl: `ws://${hostname}:${port}/api/socket`
    }, 'Server started successfully');
  });
});

function handlePlayerLeave(
  socket: any,
  io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >
) {
  const { playerId, lobbyId } = socket.data;
  if (!playerId || !lobbyId) return;

  const lobby = gameState.getLobby(lobbyId);
  if (!lobby) return;

  gameState.removePlayerFromLobby(playerId, lobbyId);
  gameState.deletePlayer(playerId);
  socket.leave(lobbyId);

  // Notify the leaving player that they've left
  socket.emit('lobby:left');
  
  // Notify other players in the lobby
  socket.to(lobbyId).emit('lobby:player-left', playerId);

  // If lobby is empty, delete it
  if (lobby.playerCount === 0) {
    gameState.deleteLobby(lobbyId);
  }
  // If host left, assign new host
  else if (lobby.hostId === playerId) {
    const players = gameState.getPlayersInLobby(lobbyId);
    if (players.length > 0) {
      gameState.updateLobby(lobbyId, { hostId: players[0].id });
      const updatedLobby = gameState.getLobby(lobbyId);
      if (updatedLobby) {
        io.to(lobbyId).emit('lobby:joined', updatedLobby, players);
      }
    }
  }

  // Broadcast updated lobby list to ALL clients
  io.emit('lobby:updated', gameState.getAllLobbies());
}

function startGame(
  io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  lobbyId: string
) {
  const lobby = gameState.getLobby(lobbyId);
  if (!lobby) return;

  gameState.updateLobby(lobbyId, { status: 'in-progress' });

  const players = gameState.getPlayersInLobby(lobbyId);
  
  // Use lobby's prompts or fallback to MOCK_PROMPTS
  const prompts = lobby.prompts && lobby.prompts.length > 0 
    ? lobby.prompts 
    : MOCK_PROMPTS;
  
  const game: GameState = {
    id: lobbyId,
    status: 'in-progress',
    players,
    currentRound: 0,
    totalRounds: prompts.length,
    prompts,
    startedAt: Date.now(),
  };

  gameState.createGame(lobbyId, game);

  io.to(lobbyId).emit('game:started', game);

  // Send first prompt after 3 seconds
  setTimeout(() => {
    sendNextRound(io, lobbyId);
  }, 3000);
}

function sendNextRound(
  io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  gameId: string
) {
  const game = gameState.getGame(gameId);
  if (!game || game.status !== 'in-progress') return;

  if (game.currentRound >= game.prompts.length) {
    // All prompts completed, start review phase
    if (!game.isReviewing) {
      logger.info({ event: 'all_prompts_completed', lobbyId: gameId }, 'All prompts completed, starting review phase');
      gameState.updateGame(gameId, { isReviewing: true });
      const answers = gameState.getAnswers(gameId);
      io.to(gameId).emit('game:review-start', game.prompts, answers);
    }
    return;
  }

  const prompt = game.prompts[game.currentRound];

  io.to(gameId).emit(
    'game:prompt',
    prompt,
    game.currentRound + 1,
    game.prompts.length
  );

  // Get lobby to check if timed mode is enabled
  const lobby = gameState.getLobby(gameId);
  const isTimedMode = lobby?.timedMode ?? true; // Default to timed if not specified

  // Only auto-progress in timed mode
  if (isTimedMode) {
    // Move to next round after 15 seconds
    setTimeout(() => {
      const currentGame = gameState.getGame(gameId);
      if (currentGame) {
        gameState.updateGame(gameId, { currentRound: currentGame.currentRound + 1 });
        sendNextRound(io, gameId);
      }
    }, 15000);
  }
  // In timeless mode, host manually triggers next round
}

function endGame(
  io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  gameId: string
) {
  const game = gameState.getGame(gameId);
  if (!game) return;

  gameState.updateGame(gameId, {
    status: 'finished',
    finishedAt: Date.now(),
  });

  const players = gameState.getPlayersInLobby(gameId);
  const finalScores = players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: p.score }))
    .sort((a, b) => b.score - a.score);

  // Send scores and prompts for review
  io.to(gameId).emit('game:finished', finalScores, game.prompts);

  // Clean up lobby after 30 seconds
  setTimeout(() => {
    gameState.deleteLobby(gameId);
    gameState.deleteGame(gameId);
  }, 30000);
}
