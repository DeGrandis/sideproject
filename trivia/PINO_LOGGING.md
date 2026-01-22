# Pino Logger Setup

Pino is configured to provide fast, non-blocking structured logging with CloudWatch integration.

## Features

- **Non-blocking**: Unlike console.log, Pino writes asynchronously
- **Structured JSON**: All logs include structured data for easy querying
- **CloudWatch Integration**: Production logs automatically sent to CloudWatch
- **Pretty Printing**: Development mode has colorized, formatted output
- **Context-aware**: Child loggers can include persistent context

## Configuration

The logger is configured in [src/lib/logger.ts](src/lib/logger.ts):

- **Development**: Pretty-printed console output with colors
- **Production**: Batched CloudWatch Logs via pino-cloudwatch
- **Log Group**: `/containers/trivia` (same as Docker awslogs)
- **Log Stream**: `app-YYYY-MM-DD` (daily rotation)

## Usage Examples

```typescript
import logger from './src/lib/logger.js';

// Simple message
logger.info('Server started');

// With structured data
logger.info({ userId: '123', action: 'login' }, 'User logged in');

// Different log levels
logger.debug({ socketId: 'abc' }, 'Socket connected');
logger.info({ gameId: '456' }, 'Game started');
logger.warn({ playerId: '789' }, 'Player timeout');
logger.error({ error: err }, 'Failed to create lobby');

// Child logger with persistent context
const gameLogger = logger.child({ gameId: '123', lobbyId: '456' });
gameLogger.info('Question answered'); // Automatically includes gameId and lobbyId
```

## Log Levels

- `trace` (10): Very detailed debugging
- `debug` (20): Debugging information
- `info` (30): General information (default)
- `warn` (40): Warning messages
- `error` (50): Error messages
- `fatal` (60): Fatal errors

Set level via `LOG_LEVEL` environment variable.

## Event Tracking

Key events logged with `event` field for easy filtering:

```typescript
logger.info({ 
  event: 'lobby_created',
  playerId,
  lobbyId,
  playerName,
  questionCount 
}, 'Player created lobby');

logger.info({ 
  event: 'player_joined',
  playerId,
  playerName,
  lobbyId 
}, 'Player joined lobby');
```

## CloudWatch Queries

Query logs in CloudWatch Logs Insights:

```sql
# Count lobbies created by theme
fields @timestamp, theme, lobbyName
| filter event = "lobby_created"
| stats count() by theme

# Track game activity
fields @timestamp, event, playerName, lobbyName
| filter event in ["lobby_created", "player_joined", "game_started"]
| sort @timestamp desc

# Error analysis
fields @timestamp, msg, error, lobbyId
| filter level = "error"
| sort @timestamp desc
```

## Cost

- Pino overhead: ~0.1ms per log (vs console.log ~10ms)
- CloudWatch: Same $0.50/GB as Docker awslogs
- Batching: Logs sent every 1 second to minimize API calls

## Dependencies

Install with:
```bash
npm install pino pino-cloudwatch
npm install -D pino-pretty  # For dev mode
```
