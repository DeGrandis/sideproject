// Type definitions for the trivia game

export interface Player {
  id: string;
  nickname: string;
  socketId: string;
  score: number;
  ready: boolean;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GameState {
  id: string;
  status: 'waiting' | 'in-progress' | 'finished';
  players: Player[];
  currentQuestion: number;
  questions: Question[];
  startedAt?: number;
  finishedAt?: number;
}

export interface LobbyInfo {
  id: string;
  name: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  difficulty: 'easy' | 'medium' | 'hard';
  theme?: string;
  questions?: Question[];
  status: 'waiting' | 'starting' | 'in-progress';
  timedMode: boolean;
}

// Socket event types
export interface ServerToClientEvents {
  // Lobby events
  'lobby:updated': (lobbies: LobbyInfo[]) => void;
  'lobby:joined': (lobby: LobbyInfo, players: Player[]) => void;
  'lobby:player-joined': (player: Player) => void;
  'lobby:player-left': (playerId: string) => void;
  'lobby:left': () => void;
  'lobby:error': (message: string) => void;
  
  // Game events
  'game:started': (gameState: GameState) => void;
  'game:question': (question: Omit<Question, 'correctAnswer'>, questionNumber: number, totalQuestions: number) => void;
  'game:answer-result': (correct: boolean, correctAnswer: number) => void;
  'game:round-end': (scores: { playerId: string; score: number }[]) => void;
  'game:finished': (finalScores: { playerId: string; nickname: string; score: number }[], questions: Question[]) => void;
  'game:data': (gameState: GameState) => void;
  'lobby:data': (lobby: LobbyInfo, players: Player[]) => void;
  'lobby:players-updated': (players: Player[]) => void;
}

export interface LobbyCreateOptions {
  nickname: string;
  lobbyName: string;
  maxPlayers: number;
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  theme?: string;
  timedMode: boolean;
}

export interface ClientToServerEvents {
  // Lobby events
  'lobby:list': () => void;
  'lobby:create': (options: LobbyCreateOptions) => void;
  'lobby:join': (lobbyId: string, nickname: string) => void;
  'lobby:leave': () => void;
  'lobby:ready': () => void;
  'lobby:start': () => void;
  'lobby:get': (lobbyId: string) => void;
  
  // Game events
  'game:answer': (questionId: string, answer: number) => void;
  'game:get': (lobbyId: string) => void;
  'game:next-question': () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  playerId?: string;
  nickname?: string;
  lobbyId?: string;
}
