import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

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

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = parseInt(process.env.PORT || '3002', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Mock trivia questions
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
  console.log('✓ Next.js prepared');
  
  // Create HTTP server without request handler
  const server = createServer(async (req, res) => {
    try {
      // Check if this is a Socket.IO request - if so, don't handle it here
      // Socket.IO will handle its own requests through the engine.io middleware
      if (!req.url?.startsWith('/api/socket')) {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
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

  console.log('✓ Socket.IO server initialized on path: /api/socket');

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    // === LOBBY EVENTS ===

    socket.on('lobby:list', () => {
      socket.emit('lobby:updated', gameState.getAllLobbies());
    });

    socket.on('lobby:create', (nickname) => {
      try {
        if (!nickname || nickname.trim().length === 0) {
          socket.emit('lobby:error', 'Nickname is required');
          return;
        }

        const playerId = uuidv4();
        const lobbyId = uuidv4();

        // Create player
        const player: Player = {
          id: playerId,
          nickname: nickname.trim(),
          socketId: socket.id,
          score: 0,
          ready: false,
        };
        gameState.createPlayer(player);

        // Create lobby
        const lobby = gameState.createLobby(lobbyId, playerId);
        gameState.addPlayerToLobby(playerId, lobbyId);

        // Store player data in socket
        socket.data.playerId = playerId;
        socket.data.nickname = nickname.trim();
        socket.data.lobbyId = lobbyId;

        // Join socket room
        socket.join(lobbyId);

        // Send lobby info
        socket.emit('lobby:joined', lobby, [player]);
        io.emit('lobby:updated', gameState.getAllLobbies());

        console.log(`Player ${nickname} created lobby ${lobbyId}`);
      } catch (error) {
        console.error('Error creating lobby:', error);
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

        console.log(`Player ${nickname} joined lobby ${lobbyId}`);
      } catch (error) {
        console.error('Error joining lobby:', error);
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
      const lobby = gameState.getLobby(lobbyId);
      const players = gameState.getPlayersInLobby(lobbyId);
      if (lobby) {
        io.to(lobbyId).emit('lobby:joined', lobby, players);
      }
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
      if (players.length < 2) {
        socket.emit('lobby:error', 'Need at least 2 players to start');
        return;
      }

      // Start game
      startGame(io, lobbyId);
    });

    // === GAME EVENTS ===

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
          gameState.updatePlayer(playerId, { score: player.score + 10 });
        }
      }

      socket.emit('game:answer-result', correct, question.correctAnswer);
      
      // Broadcast updated scores to all players in the game
      const players = gameState.getPlayersInLobby(lobbyId);
      const scores = players.map(p => ({ playerId: p.id, score: p.score }));
      io.to(lobbyId).emit('game:round-end', scores);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      handlePlayerLeave(socket, io);
    });
  });

  server.listen(port, () => {
    console.log(`\n🚀 Server ready on http://${hostname}:${port}`);
    console.log(`📡 Socket.IO listening on ws://${hostname}:${port}/api/socket\n`);
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
  const game: GameState = {
    id: lobbyId,
    status: 'in-progress',
    players,
    currentQuestion: 0,
    questions: MOCK_QUESTIONS,
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

  // Move to next question after 10 seconds
  setTimeout(() => {
    const currentGame = gameState.getGame(gameId);
    if (currentGame) {
      gameState.updateGame(gameId, { currentQuestion: currentGame.currentQuestion + 1 });
      sendNextQuestion(io, gameId);
    }
  }, 10000);
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

  io.to(gameId).emit('game:finished', finalScores);

  // Clean up lobby after 30 seconds
  setTimeout(() => {
    gameState.deleteLobby(gameId);
    gameState.deleteGame(gameId);
  }, 30000);
}
