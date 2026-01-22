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
  Question,
} from './src/lib/types.js';
import { gameState } from './src/lib/gameState.js';
import { generateQuestions } from './src/lib/questionGenerator.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = parseInt(process.env.PORT || '3002', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Function to fetch questions using AWS Bedrock
async function fetchQuestionsFromAPI(
  difficulty: 'easy' | 'medium' | 'hard',
  theme?: string,
  count: number = 10,
  userFingerprint?: string
): Promise<Question[]> {
  try {
    logger.info({ 
      event: 'questions_requested',
      difficulty, 
      theme: theme || 'general', 
      count,
      userFingerprint: userFingerprint || 'unknown'
    }, 'Fetching questions from Bedrock');
    
    // Generate questions using AWS Bedrock
    const generatedQuestions = await generateQuestions({
      theme: theme || 'general knowledge',
      difficulty,
      count,
    });

    // Transform to Question format with IDs and category
    return generatedQuestions.map(q => ({
      id: uuidv4(),
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      category: theme || 'General Knowledge',
      difficulty,
    }));
  } catch (error) {
    logger.error({ 
      error, 
      difficulty, 
      theme,
      userFingerprint: userFingerprint || 'unknown'
    }, 'Error fetching questions from Bedrock, falling back to mock');
    // Fallback to mock questions on error
    return MOCK_QUESTIONS.map((q) => ({
      ...q,
      id: uuidv4(),
      difficulty,
      category: theme || q.category,
    }));
  }
}

// Mock trivia questions (fallback)
const MOCK_QUESTIONS: Question[] = [
  {
    id: '1',
    question: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctAnswer: 2,
    category: 'Geography',
    difficulty: 'easy',
  },
  {
    id: '2',
    question: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctAnswer: 1,
    category: 'Science',
    difficulty: 'easy',
  },
  {
    id: '3',
    question: 'Who wrote "Romeo and Juliet"?',
    options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'],
    correctAnswer: 1,
    category: 'Literature',
    difficulty: 'medium',
  },
];

app.prepare().then(() => {
  logger.info('Next.js application prepared');
  
  // Create HTTP server without request handler
  const server = createServer(async (req, res) => {
    try {
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
      origin: dev ? 'http://localhost:3002' : ['https://trivia.degrand.is', 'https://degrand.is'],
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

        // Fetch questions dynamically based on difficulty and theme
        const questions = await fetchQuestionsFromAPI(
          options.difficulty || 'medium',
          options.theme?.trim(),
          options.questionCount || 10,
          userFingerprint
        );
        logger.info({ 
          event: 'questions_fetched',
          questionCount: questions.length, 
          difficulty: options.difficulty, 
          theme: options.theme,
          userFingerprint: userFingerprint
        }, 'Questions fetched successfully');

        // Log each question individually for searchability
        questions.forEach((q, index) => {
          logger.info({
            event: 'question_generated',
            lobbyId,
            questionIndex: index,
            questionText: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            category: q.category,
            difficulty: q.difficulty,
            theme: options.theme,
            userFingerprint: userFingerprint,
          }, 'Question generated');
        });

        // Create lobby with new parameters including questions
        const lobby = gameState.createLobby(
          lobbyId,
          playerId,
          options.lobbyName.trim(),
          options.maxPlayers || 8,
          options.difficulty || 'medium',
          options.theme?.trim(),
          questions,
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
          questionCount: questions.length,
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
        logger.debug({ lobbyId, socketId: socket.id, questionCount: game.questions.length }, 'Sent game data');
      } catch (error) {
        logger.error({ error, lobbyId }, 'Error getting game');
        socket.emit('lobby:error', 'Failed to get game data');
      }
    });

    socket.on('game:answer', (questionId, answer) => {
      const { playerId, lobbyId } = socket.data;
      if (!playerId || !lobbyId) return;

      const game = gameState.getGame(lobbyId);
      if (!game || game.status !== 'in-progress') return;

      const question = game.questions.find((q) => q.id === questionId);
      if (!question) return;

      const correct = answer === question.correctAnswer;
      if (correct) {
        const player = gameState.getPlayer(playerId);
        if (player) {
          gameState.updatePlayer(playerId, { score: player.score + 100 });
        }
      }

      socket.emit('game:answer-result', correct, question.correctAnswer);
      
      // Notify all players that this player has answered
      io.to(lobbyId).emit('game:player-answered', playerId);
      
      // Broadcast updated scores to all players in the game
      const players = gameState.getPlayersInLobby(lobbyId);
      const scores = players.map(p => ({ playerId: p.id, score: p.score }));
      io.to(lobbyId).emit('game:round-end', scores);
    });

    // Manual progression for timeless mode
    socket.on('game:next-question', () => {
      const { lobbyId, playerId } = socket.data;
      if (!lobbyId || !playerId) return;

      const lobby = gameState.getLobby(lobbyId);
      if (!lobby || lobby.hostId !== playerId) {
        // Only host can progress
        return;
      }

      const game = gameState.getGame(lobbyId);
      if (!game || game.status !== 'in-progress') return;

      // Move to next question
      gameState.updateGame(lobbyId, { currentQuestion: game.currentQuestion + 1 });
      sendNextQuestion(io, lobbyId);
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
  
  // Use lobby's questions or fallback to MOCK_QUESTIONS
  const questions = lobby.questions && lobby.questions.length > 0 
    ? lobby.questions 
    : MOCK_QUESTIONS;
  
  const game: GameState = {
    id: lobbyId,
    status: 'in-progress',
    players,
    currentQuestion: 0,
    questions,
    startedAt: Date.now(),
  };

  gameState.createGame(lobbyId, game);

  io.to(lobbyId).emit('game:started', game);

  // Send first question after 3 seconds
  setTimeout(() => {
    sendNextQuestion(io, lobbyId);
  }, 3000);
}

function sendNextQuestion(
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

  if (game.currentQuestion >= game.questions.length) {
    // Game finished
    endGame(io, gameId);
    return;
  }

  const question = game.questions[game.currentQuestion];
  const { correctAnswer, ...questionWithoutAnswer } = question;

  io.to(gameId).emit(
    'game:question',
    questionWithoutAnswer,
    game.currentQuestion + 1,
    game.questions.length
  );

  // Get lobby to check if timed mode is enabled
  const lobby = gameState.getLobby(gameId);
  const isTimedMode = lobby?.timedMode ?? true; // Default to timed if not specified

  // Only auto-progress in timed mode
  if (isTimedMode) {
    // Move to next question after 10 seconds
    setTimeout(() => {
      const currentGame = gameState.getGame(gameId);
      if (currentGame) {
        gameState.updateGame(gameId, { currentQuestion: currentGame.currentQuestion + 1 });
        sendNextQuestion(io, gameId);
      }
    }, 10000);
  }
  // In timeless mode, host manually triggers next question
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

  // Send scores and questions for review
  io.to(gameId).emit('game:finished', finalScores, game.questions);

  // Clean up lobby after 30 seconds
  setTimeout(() => {
    gameState.deleteLobby(gameId);
    gameState.deleteGame(gameId);
  }, 30000);
}
