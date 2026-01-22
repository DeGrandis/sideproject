# Trivia Game

A real-time multiplayer trivia game built with Next.js 14, Socket.io, and TypeScript.

## Features

- 🎮 Real-time multiplayer gameplay
- 🏆 Live scoring and leaderboards
- 🎯 Multiple categories and difficulty levels
- 📱 Responsive design
- 🔄 Lobby system with ready checks
- ⏱️ Timed questions (15 seconds)

## Tech Stack

- **Frontend & Backend**: Next.js 14 (App Router)
- **Real-time Communication**: Socket.io 4.7
- **Language**: TypeScript 5.0
- **Styling**: CSS-in-JS (styled-jsx)
- **State Management**: In-memory (Redis-like interface for easy migration)

## Local Development

### Prerequisites

- Node.js 18+ and npm

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3002](http://localhost:3002) in your browser

### Available Scripts

- `npm run dev` - Start development server on port 3002
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## How to Play

1. **Create or Join a Lobby**
   - Enter your nickname
   - Create a new lobby or join an existing one

2. **Wait for Players**
   - The host (👑) can start the game when ready
   - Other players must click "Ready" before the game can start
   - Minimum 2 players required

3. **Answer Questions**
   - You have 15 seconds to answer each question
   - Click your answer choice
   - Earn 10 points for each correct answer
   - See live scores throughout the game

4. **View Results**
   - Final leaderboard shows at the end
   - Game automatically returns to lobby after 10 seconds

## Architecture

### Directory Structure

```
trivia/
├── src/
│   ├── app/
│   │   ├── api/socket/       # Socket.io API route
│   │   ├── layout.tsx        # Root layout with SocketProvider
│   │   ├── page.tsx          # Home page with lobby list
│   │   └── globals.css       # Global styles
│   ├── components/
│   │   ├── Game.tsx          # Game view component
│   │   ├── Lobby.tsx         # Lobby view component
│   │   └── SocketProvider.tsx # Socket.io context provider
│   └── lib/
│       ├── gameState.ts      # In-memory state manager
│       ├── socket.ts         # Socket.io server logic
│       └── types.ts          # TypeScript interfaces
├── package.json
├── tsconfig.json
└── next.config.js
```

### State Management

The in-memory state manager (`gameState.ts`) follows Redis-like conventions:

- **Key Patterns**:
  - `lobby:{id}` → LobbyInfo
  - `game:{id}` → GameState
  - `player:{id}` → Player
  - `lobby:players:{lobbyId}` → Set<playerId>

- **Easy Redis Migration**: All methods (`hset`, `hget`, `sadd`, etc.) are designed to match Redis commands, making it trivial to swap to an actual Redis instance later.

### Socket.io Events

#### Client → Server
- `lobby:create` - Create a new lobby
- `lobby:join` - Join an existing lobby
- `lobby:leave` - Leave the current lobby
- `lobby:ready` - Mark player as ready
- `lobby:start` - Start the game (host only)
- `game:answer` - Submit an answer

#### Server → Client
- `lobby:updated` - Lobby list updated
- `lobby:joined` - Successfully joined a lobby
- `lobby:player-joined` - Another player joined
- `lobby:player-left` - A player left
- `lobby:error` - Lobby operation error
- `game:started` - Game has started
- `game:question` - New question
- `game:answer-result` - Your answer result
- `game:finished` - Game ended with final scores

## Docker Deployment

See [docker-compose.yaml](../docker-compose.yaml) for production deployment configuration.

The trivia service should be added to the main compose file with:
- Port mapping: `3002:3002`
- Environment variables for production URL
- Nginx reverse proxy configuration for `trivia.degrand.is`

## Future Enhancements

- [ ] Question database/API integration
- [ ] Different game modes (timed, survival, etc.)
- [ ] User authentication and persistent stats
- [ ] Custom lobby settings (question count, time limit)
- [ ] Private lobbies with invite codes
- [ ] Redis integration for distributed state
- [ ] Spectator mode
- [ ] Chat functionality

## License

MIT
