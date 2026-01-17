/**
 * In-memory game state manager
 * Following Redis-like conventions for easy migration later
 * 
 * Key patterns (Redis-style):
 * - lobby:{id} -> LobbyInfo
 * - game:{id} -> GameState
 * - player:{id} -> Player
 * - lobby:players:{lobbyId} -> Set<playerId>
 */

import { GameState, LobbyInfo, Player } from './types';

class GameStateManager {
  // In-memory stores (will be replaced with Redis)
  private lobbies: Map<string, LobbyInfo> = new Map();
  private games: Map<string, GameState> = new Map();
  private players: Map<string, Player> = new Map();
  private lobbyPlayers: Map<string, Set<string>> = new Map();
  private playerToLobby: Map<string, string> = new Map();
  private playerToGame: Map<string, string> = new Map();

  // === Lobby Operations ===
  
  createLobby(lobbyId: string, hostId: string, maxPlayers: number = 8): LobbyInfo {
    const lobby: LobbyInfo = {
      id: lobbyId,
      hostId,
      playerCount: 0,
      maxPlayers,
      status: 'waiting',
    };
    this.lobbies.set(lobbyId, lobby);
    this.lobbyPlayers.set(lobbyId, new Set());
    return lobby;
  }

  getLobby(lobbyId: string): LobbyInfo | undefined {
    return this.lobbies.get(lobbyId);
  }

  getAllLobbies(): LobbyInfo[] {
    return Array.from(this.lobbies.values()).filter(l => l.status === 'waiting');
  }

  deleteLobby(lobbyId: string): void {
    this.lobbies.delete(lobbyId);
    this.lobbyPlayers.delete(lobbyId);
  }

  updateLobby(lobbyId: string, updates: Partial<LobbyInfo>): LobbyInfo | undefined {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return undefined;
    
    const updated = { ...lobby, ...updates };
    this.lobbies.set(lobbyId, updated);
    return updated;
  }

  // === Player Operations ===
  
  createPlayer(player: Player): void {
    this.players.set(player.id, player);
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  deletePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.playerToLobby.delete(playerId);
    this.playerToGame.delete(playerId);
  }

  updatePlayer(playerId: string, updates: Partial<Player>): Player | undefined {
    const player = this.players.get(playerId);
    if (!player) return undefined;
    
    const updated = { ...player, ...updates };
    this.players.set(playerId, updated);
    return updated;
  }

  // === Lobby-Player Relationships ===
  
  addPlayerToLobby(playerId: string, lobbyId: string): boolean {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return false;
    
    const players = this.lobbyPlayers.get(lobbyId);
    if (!players || players.size >= lobby.maxPlayers) return false;
    
    players.add(playerId);
    this.playerToLobby.set(playerId, lobbyId);
    
    // Update player count
    this.updateLobby(lobbyId, { playerCount: players.size });
    
    return true;
  }

  removePlayerFromLobby(playerId: string, lobbyId: string): void {
    const players = this.lobbyPlayers.get(lobbyId);
    if (players) {
      players.delete(playerId);
      this.updateLobby(lobbyId, { playerCount: players.size });
    }
    this.playerToLobby.delete(playerId);
  }

  getPlayersInLobby(lobbyId: string): Player[] {
    const playerIds = this.lobbyPlayers.get(lobbyId);
    if (!playerIds) return [];
    
    return Array.from(playerIds)
      .map(id => this.players.get(id))
      .filter((p): p is Player => p !== undefined);
  }

  getPlayerLobby(playerId: string): string | undefined {
    return this.playerToLobby.get(playerId);
  }

  // === Game Operations ===
  
  createGame(gameId: string, gameState: GameState): void {
    this.games.set(gameId, gameState);
  }

  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  updateGame(gameId: string, updates: Partial<GameState>): GameState | undefined {
    const game = this.games.get(gameId);
    if (!game) return undefined;
    
    const updated = { ...game, ...updates };
    this.games.set(gameId, updated);
    return updated;
  }

  deleteGame(gameId: string): void {
    this.games.delete(gameId);
  }

  addPlayerToGame(playerId: string, gameId: string): void {
    this.playerToGame.set(playerId, gameId);
  }

  getPlayerGame(playerId: string): string | undefined {
    return this.playerToGame.get(playerId);
  }

  // === Cleanup ===
  
  cleanup(): void {
    // Remove finished games older than 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [gameId, game] of this.games.entries()) {
      if (game.status === 'finished' && game.finishedAt && game.finishedAt < oneHourAgo) {
        this.deleteGame(gameId);
      }
    }
    
    // Remove empty lobbies
    for (const [lobbyId, lobby] of this.lobbies.entries()) {
      if (lobby.playerCount === 0) {
        this.deleteLobby(lobbyId);
      }
    }
  }
}

// Singleton instance
export const gameState = new GameStateManager();

// Run cleanup every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => gameState.cleanup(), 5 * 60 * 1000);
}
