# Trivia App - Quick Reference Notes

## Logging

### Pino Logger (Structured Logging)
- **Library**: Pino with CloudWatch transport (non-blocking, asynchronous)
- **Log Location**: 
  - Development: Colorized console output
  - Production: CloudWatch Logs at `/containers/trivia`
- **Documentation**: See [PINO_LOGGING.md](PINO_LOGGING.md) for detailed usage

### Key Event Tracking
All major events logged with structured data:
- `lobby_created` - Track lobby creation with theme, difficulty, player info
- `player_joined` - Track when players join lobbies
- Game lifecycle events

### Query Examples (CloudWatch Logs Insights)
```sql
# Count lobbies by theme
fields @timestamp, theme, lobbyName
| filter event = "lobby_created"
| stats count() by theme

# Track player activity
fields @timestamp, event, playerName, lobbyName
| filter event in ["lobby_created", "player_joined"]
| sort @timestamp desc
```

## CloudWatch Logs - Viewing Logs Remotely

### Requirements
- **Use PowerShell** (not Git Bash) - Git Bash converts `/containers/trivia` to `C:/Program Files/Git/containers/trivia`
- AWS CLI configured with credentials that have CloudWatch Logs read permissions
- Log group: `/containers/trivia`

### Common Commands

```powershell
# View live logs (real-time)
aws logs tail /containers/trivia --follow

# View last 30 minutes
aws logs tail /containers/trivia --since 30m

# Follow logs with time filter
aws logs tail /containers/trivia --since 30m --follow

# Filter for errors only
aws logs tail /containers/trivia --follow --filter-pattern ERROR

# Filter for specific events
aws logs tail /containers/trivia --follow --filter-pattern "lobby:create"
aws logs tail /containers/trivia --follow --filter-pattern "socket"
aws logs tail /containers/trivia --follow --filter-pattern "bedrock"

# List available log groups
aws logs describe-log-groups --log-group-name-prefix /containers

# Check log streams
aws logs describe-log-streams --log-group-name /containers/trivia
```

### Git Bash Workaround (if needed)
```bash
# Disable path conversion
MSYS_NO_PATHCONV=1 aws logs tail /containers/trivia --follow
```

---

## Docker Commands

```bash
# Build and start trivia container
docker compose up --build trivia

# View local container logs
docker logs trivia --follow

# Restart trivia container
docker compose restart trivia

# Stop and remove
docker compose down trivia

# Check if container is using awslogs driver
docker inspect trivia | grep -A 10 "LogConfig"
```

---

## Deployment

```bash
# Push to master branch triggers GitHub Actions CI/CD
git push origin master

# Wait 2-5 minutes for deployment to complete
# Check deployment status at: https://github.com/YOUR_USERNAME/YOUR_REPO/actions

# After deployment, verify logs are flowing
aws logs tail /containers/trivia --since 5m
```

---

## Debug Game Page

For rapid UI testing without creating full games:
- Local: http://localhost:3002/debug-game
- Production: https://trivia.degrand.is/debug-game

---

## Cost Monitoring

- **AWS Bedrock**: ~$0.001-0.002 per API call (generates all questions for one game in a single call)
  - Llama 3.1 70B: $0.00099 per 1K tokens (input + output)
  - Typical game: ~1000 tokens total = ~$0.001 per game
- **CloudWatch Logs**: ~$0.50/GB ingested, ~$0.03/GB stored (first 5GB ingestion/month free)
- Set AWS Budget alerts in AWS Console for spending limits
- Rate limiting: Server enforces cooldown per user for question generation
