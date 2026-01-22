// Type definitions for the apples-to-apples style game

export interface Player {
  id: string;
  nickname: string;
  socketId: string;
  score: number;
  ready: boolean;
}

export interface Prompt {
  id: string;
  text: string;
  category: string;
}

export interface GameState {
  id: string;
  status: 'waiting' | 'in-progress' | 'reviewing' | 'finished';
  players: Player[];
  currentRound: number;
  totalRounds: number;
  prompts: Prompt[];
  startedAt?: number;
  finishedAt?: number;
  isReviewing?: boolean;
}

export interface LobbyInfo {
  id: string;
  name: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  difficulty: 'easy' | 'medium' | 'hard';
  theme?: string;
  prompts?: Prompt[];
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
  'game:prompt': (prompt: Prompt, roundNumber: number, totalRounds: number) => void;
  'game:player-answered': (playerId: string) => void;
  'game:answer': (promptId: string, playerId: string, answer: string) => void;
  'game:round-end': (scores: { playerId: string; score: number }[]) => void;
  'game:review-start': (prompts: Prompt[], answers: { [promptId: string]: { [playerId: string]: string } }) => void;
  'game:review-next-prompt': (nextIndex: number) => void;
  'game:grades-ready': (promptIndex: number, gradedAnswers: Array<{ playerId: string; nickname: string; answer: string; score: number; reasoning: string }>) => void;
  'game:finish-review': () => void;
  'game:finished': (finalScores: { playerId: string; nickname: string; score: number }[], prompts: Prompt[]) => void;
  'game:data': (gameState: GameState) => void;
  'lobby:data': (lobby: LobbyInfo, players: Player[]) => void;
  'lobby:players-updated': (players: Player[]) => void;
  'game:answer-result': (success: boolean) => void;
}

export interface LobbyCreateOptions {
  nickname: string;
  lobbyName: string;
  maxPlayers: number;
  roundCount: number;
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
  'game:answer': (promptId: string, answer: string) => void;
  'game:get': (lobbyId: string) => void;
  'game:next-round': () => void;
  'game:review-next-prompt': (nextIndex: number) => void;
  'game:grade-prompt': (promptIndex: number) => void;
  'game:finish-review': () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  playerId?: string;
  nickname?: string;
  lobbyId?: string;
}
