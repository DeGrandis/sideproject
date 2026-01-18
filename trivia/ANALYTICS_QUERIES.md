# Analytics & Metrics Queries

Now that structured logging is set up with Pino, you can track all your metrics using CloudWatch Logs Insights queries.

## Setup

1. Go to AWS CloudWatch Console → Logs → Insights
2. Select log group: `/containers/trivia`
3. Paste any query below and click "Run query"

## Visitor & Traffic Metrics

### Unique Visitors (by User-Agent Fingerprint)
```sql
fields userAgentFingerprint
| filter event = "client_connected"
| stats count_distinct(userAgentFingerprint) as unique_visitors
```

### Unique Visitors Over Time
```sql
fields userAgentFingerprint
| filter event = "client_connected"
| stats count_distinct(userAgentFingerprint) as unique_visitors by bin(1h)
```

### Total Site Hits (Connections)
```sql
fields @timestamp
| filter event = "client_connected"
| stats count() as total_connections
```

### Site Hits Over Time
```sql
fields @timestamp
| filter event = "client_connected"
| stats count() as connections by bin(30m)
```

### Visitor IPs (Top 20)
```sql
fields clientIp
| filter event = "client_connected"
| stats count() as visits by clientIp
| sort visits desc
| limit 20
```

### User Agent Analysis
```sql
fields userAgent, userAgentFingerprint
| filter event = "client_connected"
| stats count() as connections by userAgent
| sort connections desc
| limit 20
```

## Site Activity Metrics

### Total Lobbies Created
```sql
fields @timestamp
| filter event = "lobby_created"
| stats count() as total_lobbies
```

### Lobbies Created Over Time (Daily)
```sql
fields @timestamp
| filter event = "lobby_created"
| stats count() as lobbies by bin(30m)
```

### Lobbies by Theme
```sql
fields theme, lobbyName, playerName
| filter event = "lobby_created"
| stats count() as game_count by theme
| sort game_count desc
```

### Lobbies by Difficulty
```sql
fields difficulty, lobbyName
| filter event = "lobby_created"
| stats count() as game_count by difficulty
| sort game_count desc
```

### Most Popular Themes (Last 7 Days)
```sql
fields theme
| filter event = "lobby_created"
| filter @timestamp > ago(7d)
| stats count() as plays by theme
| sort plays desc
| limit 10
```

## Player Activity

### Total Players (Unique Lobbies Joined)
```sql
fields event, playerName, lobbyId
| filter event = "player_joined"
| stats count_distinct(playerName) as unique_players
```

### Active Players Over Time
```sql
fields playerName
| filter event = "player_joined"
| stats count_distinct(playerName) as players by bin(1h)
```

### Most Active Players
```sql
fields playerName
| filter event in ["lobby_created", "player_joined"]
| stats count() as games_played by playerName
| sort games_played desc
| limit 20
```

## Game Settings Analysis

### Average Questions Per Game
```sql
fields questionCount
| filter event = "lobby_created"
| stats avg(questionCount) as avg_questions, 
        min(questionCount) as min_questions,
        max(questionCount) as max_questions
```

### Game Settings Distribution
```sql
fields difficulty, theme, questionCount
| filter event = "lobby_created"
| display difficulty, theme, questionCount, lobbyName, playerName, @timestamp
| sort @timestamp desc
| limit 100
```

## Traffic Patterns

### Connection Activity
```sql
fields msg, socketId
| filter msg in ["Client connected", "Client disconnected"]
| stats count() as connections by msg, bin(1h)
```

### Peak Usage Hours
```sql
fields @timestamp
| filter event in ["lobby_created", "player_joined"]
| stats count() as activity by bin(1h)
| sort activity desc
```

### Active Lobbies Over Time
```sql
fields lobbyId
| filter event = "lobby_created"
| stats count() as lobbies by bin(30m)
```

## Error Tracking

### All Errors
```sql
fields @timestamp, msg, error, lobbyId
| filter level = "error"
| sort @timestamp desc
| limit 50
```

### Error Rate
```sql
fields level
| filter level = "error"
| stats count() as error_count by bin(1h)
```

### Bedrock API Errors
```sql
fields error, difficulty, theme
| filter msg = "Error fetching questions from Bedrock, falling back to mock"
| sort @timestamp desc
```

## Cost Tracking

### Bedrock API Calls (Game Creations)
```sql
fields @timestamp, difficulty, theme, questionCount
| filter msg = "Questions fetched successfully"
| stats count() as api_calls, 
        sum(questionCount) as total_questions
```

### Estimated Bedrock Costs
```sql
fields questionCount
| filter event = "lobby_created"
| stats count() as total_games, 
        sum(questionCount) as total_questions
| extend estimated_cost = total_games * 0.0015
| display total_games, total_questions, estimated_cost
```

## Custom Dashboard Queries

### Real-time Activity Summary (Last Hour)
```sql
fields event, msg
| filter event in ["lobby_created", "player_joined"] 
        or msg in ["Client connected", "Client disconnected"]
| filter @timestamp > ago(1h)
| stats count() as count by event, msg
```

### Game Session Summary
```sql
fields lobbyName, playerName, theme, difficulty, questionCount
| filter event = "lobby_created"
| filter @timestamp > ago(24h)
| sort @timestamp desc
| limit 50
```

## Exporting Data

To export data for further analysis:

1. Run your query in CloudWatch Logs Insights
2. Click "Export results" → Download CSV
3. Analyze in Excel, Google Sheets, or visualization tools

## Automation (Optional)

Create CloudWatch Dashboard with these widgets:
```bash
# Using AWS CLI to create a dashboard
aws cloudwatch put-dashboard --dashboard-name TriviaDashboard --dashboard-body file://dashboard.json
```

Or use AWS CDK/Terraform to codify your dashboards and alerts.

## Notes

- All timestamps are in UTC
- Use `ago(Xd)`, `ago(Xh)`, or `ago(Xm)` for relative time filtering
- Results limited to 10,000 rows per query
- Query costs: ~$0.005 per GB scanned
