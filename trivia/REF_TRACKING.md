# Referral Tracking Implementation

## Overview
The application now tracks referral sources via `?ref=` URL parameters and logs them for CloudWatch analysis.

## How It Works

### 1. User Visits with Ref Parameter
```
https://trivia.degrand.is/?ref=reddit
https://trivia.degrand.is/?ref=twitter
https://trivia.degrand.is/?ref=email-campaign
```

### 2. Logging Points

**Page Visit (HTTP)**
- Location: `server.ts` HTTP request handler
- Logged when user loads the main page (`/`) with a ref parameter
- Log event: `page_visit_with_ref`

**Socket Connection**
- Location: `server.ts` Socket.IO connection handler
- Logged when Socket.IO connects with ref parameter from URL
- Log event: `client_connected` with `ref` field

### 3. Log Structure

**Page Visit Log:**
```json
{
  "event": "page_visit_with_ref",
  "ref": "reddit",
  "url": "/?ref=reddit",
  "userAgent": "Mozilla/5.0...",
  "ip": "1.2.3.4"
}
```

**Socket Connection Log:**
```json
{
  "event": "client_connected",
  "socketId": "abc123",
  "clientIp": "1.2.3.4",
  "userAgent": "Mozilla/5.0...",
  "userFingerprint": "a1b2c3d4",
  "ref": "reddit"
}
```

## CloudWatch Queries

### Group by Referral Source
```
fields @timestamp, ref, clientIp
| filter event = "client_connected"
| stats count() by ref
| sort count desc
```

### Track Conversions by Ref
```
fields @timestamp, ref, event
| filter event in ["client_connected", "lobby_created", "player_joined"]
| stats count() by ref, event
```

### Timeline by Ref
```
fields @timestamp, ref
| filter event = "client_connected" and ref != "none"
| stats count() by bin(5m) as time_bucket, ref
```

### Unique Users by Ref
```
fields userFingerprint, ref
| filter event = "client_connected" and ref != "none"
| stats count_distinct(userFingerprint) by ref
```

## Testing Locally

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Visit with ref parameter:**
   ```
   http://localhost:3002/?ref=test
   ```

3. **Check console logs:**
   - Browser console should show: `📊 Ref parameter detected: test`
   - Server logs should show both page visit and socket connection with ref

4. **Check without ref:**
   ```
   http://localhost:3002/
   ```
   - Socket connection log will show `ref: "none"`

## Production Deployment

After deploying, test with:
```bash
# Page visit
curl -I "https://trivia.degrand.is/?ref=test"

# Check CloudWatch Logs
# Navigate to CloudWatch > Log groups > /ecs/trivia
# Filter: { $.ref = "test" }
```

## URL Examples for Different Sources

```
Social Media:
  - https://trivia.degrand.is/?ref=facebook
  - https://trivia.degrand.is/?ref=twitter
  - https://trivia.degrand.is/?ref=reddit
  - https://trivia.degrand.is/?ref=linkedin

Email:
  - https://trivia.degrand.is/?ref=newsletter-jan26
  - https://trivia.degrand.is/?ref=welcome-email

Ads:
  - https://trivia.degrand.is/?ref=google-ads
  - https://trivia.degrand.is/?ref=facebook-ads

Partners:
  - https://trivia.degrand.is/?ref=partner-abc
```

## Notes

- Ref parameter persists through the socket connection for the entire session
- If no ref is provided, logs show `ref: "none"`
- Ref is case-sensitive (recommend lowercase conventions)
- Ref parameter does NOT persist across page reloads (single-page-app behavior)
- Maximum CloudWatch retention depends on log group settings
