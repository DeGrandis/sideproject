# Trivia App Dockerization Summary

## Changes Made

### 1. Updated Dockerfile ([trivia/Dockerfile](trivia/Dockerfile))
- Changed from multi-stage Next.js standalone build to single-stage build
- Uses Node.js 22 (matching other frontends)
- Installs dependencies with `npm ci`
- Builds Next.js app with `npm run build`
- Runs custom server via `npm run start` (which executes `tsx server.ts`)
- Exposes port 3002
- Sets `NODE_ENV=production`

### 2. Updated Server Configuration ([trivia/server.ts](trivia/server.ts))
- Hostname now respects environment: `localhost` in dev, `0.0.0.0` in production
- Port reads from `process.env.PORT` with fallback to 3002
- CORS origins updated for production: allows `https://trivia.degrand.is` and `https://degrand.is`

### 3. Added to Docker Compose ([docker-compose.yaml](docker-compose.yaml))
```yaml
trivia:
  build:
    context: ./trivia
  image: degrandis/trivia:latest
  ports:
    - "3002:3002"
  environment:
    - NODE_ENV=production
  networks:
    - client-side
```

### 4. Updated Nginx Configuration ([nginx/nginx.conf](nginx/nginx.conf))
- Added `trivia.degrand.is` to HTTP redirect server block
- Created new HTTPS server block for `trivia.degrand.is`
- Configured Socket.IO WebSocket support:
  - Main location block proxies to `http://trivia:3002/`
  - Special `/api/socket` location with WebSocket upgrade headers
  - Long read timeout (86400s) for persistent connections
  - Proper proxy headers for real IP, forwarding, etc.

### 5. Updated Nginx Dependencies
- Added `trivia` and `budget_frontend` to nginx `depends_on` list

### 6. Updated AGENTS.md
- Added trivia app to project overview
- Documented trivia architecture (Next.js custom server + Socket.IO)
- Added trivia to Docker commands
- Added per-project Docker usage for trivia
- Documented Socket.IO patterns and conventions

## Production URL
**https://trivia.degrand.is**

## How to Deploy

### Local Testing
```bash
# Build and run locally
docker compose up --build trivia

# Or just trivia
docker build -t trivia ./trivia
docker run -p 3002:3002 -e NODE_ENV=production trivia
```

### Production Deployment
Push to `master` branch - GitHub Actions will automatically:
1. Build the `degrandis/trivia:latest` image
2. Push to Docker Hub
3. Deploy to EC2
4. Container will be accessible at https://trivia.degrand.is

## Key Technical Details

### Socket.IO in Production
- **Path**: `/api/socket`
- **Transports**: WebSocket (primary), polling (fallback)
- **CORS**: Restricted to `trivia.degrand.is` and `degrand.is`
- **Nginx**: Special location block handles WebSocket upgrade properly

### Port Configuration
- **Container**: 3002
- **Host**: 3002 (mapped in docker-compose)
- **Nginx**: Proxies HTTPS traffic to container

### Network
- Uses `client-side` network (shared with other frontends and nginx)
- No database connection needed (in-memory game state)

## Files Modified
1. `trivia/Dockerfile` - Production-ready build
2. `trivia/server.ts` - Production hostname/port/CORS
3. `docker-compose.yaml` - Added trivia service
4. `nginx/nginx.conf` - Added subdomain with Socket.IO support
5. `AGENTS.md` - Documentation updates

## No Additional Secrets Required
The trivia app doesn't need any secrets - it runs standalone with just `NODE_ENV=production`.
