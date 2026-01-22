# AI Coding Agent Instructions

## Project Overview
- This repo hosts multiple services orchestrated via Docker Compose: auth backend, a simple demo backend, several React/Vite frontends, a Next.js trivia app with Socket.IO, Postgres, and nginx; see [docker-compose.yaml](docker-compose.yaml).
- Auth is handled by a dedicated FastAPI service in [auth_backend](auth_backend), which owns user accounts, password hashing, JWT issuance/verification, and login tracking.
- UI is split into Vite-based React apps: the primary auth UI in [auth_frontend](auth_frontend), a budget UI in [budget_frontend](budget_frontend), a generic starter in [frontend](frontend), and a real-time multiplayer trivia game in [trivia](trivia).

## Architecture and Data Flow
- The auth backend ([auth_backend/auth_service.py](auth_backend/auth_service.py)) exposes endpoints for `/login`, `/create-account`, `/issue-authorization-code`, `/redeem-authorization-code`, `/verify-token`, `/protected`, and `/healthcheck`.
- User data is stored in Postgres using SQLAlchemy models defined in [auth_backend/UserModel.py](auth_backend/UserModel.py) and session helpers in [auth_backend/db_connection.py](auth_backend/db_connection.py).
- Passwords are always hashed with bcrypt via `hash_password`/`check_password` in [auth_backend/db_connection.py](auth_backend/db_connection.py); never store or compare plain-text passwords.
- JWTs are signed with an RSA private key (`JWT_SECRET`) and verified with a public key (`JWT_PUBLIC_KEY`), configured via environment variables and validated at startup in [auth_backend/auth_service.py](auth_backend/auth_service.py).
- The main non-auth backend in [backend/main.py](backend/main.py) is a minimal FastAPI app used for simple API experimentation (e.g., `/hello`, `/items/{item_id}`).
- The trivia app ([trivia](trivia)) is a Next.js 14 application with a custom Node.js server that integrates Socket.IO for real-time multiplayer gameplay; see [trivia/server.ts](trivia/server.ts) for the server implementation and [trivia/src/lib/gameState.ts](trivia/src/lib/gameState.ts) for in-memory game state management.

## Runtime and Environment
- Docker is the primary way to run the system locally/for deployment; service definitions and env wiring live in [docker-compose.yaml](docker-compose.yaml).
- The `auth_backend` service expects `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `JWT_SECRET`, `JWT_PUBLIC_KEY`, `COOKIE_DOMAIN`, and `RUNNING_ENV` to be set; see the `auth_backend` section in [docker-compose.yaml](docker-compose.yaml#L27-L60) as the source of truth.
- Local development can load `.env.local` when `RUNNING_ENV` is not `production`; rely on that pattern if adding new environment variables in [auth_backend/auth_service.py](auth_backend/auth_service.py).
- Database schema is bootstrapped from [postgres/init-scripts/schema.sql](postgres/init-scripts/schema.sql) via the Postgres container entrypoint.

### Docker / docker-compose commands
- From the repo root, build and start the full stack (auth frontend, budget frontend, trivia app, auth backend, Postgres, nginx) with:
	- `docker compose up --build`
- To start only a specific service with its dependencies, use the service name from [docker-compose.yaml](docker-compose.yaml):
	- `docker compose up --build auth_backend`
	- `docker compose up --build frontend`
	- `docker compose up --build budget_frontend`
	- `docker compose up --build trivia`
- To rebuild images without cache (mirroring CI behavior) run:
	- `docker compose build --no-cache`
- To stop and remove containers while keeping images and volumes:
	- `docker compose down`

### Per-project Docker usage
- Auth backend ([auth_backend](auth_backend)):
	- Build image locally: `docker build -t auth_backend ./auth_backend`
	- Run container: `docker run -p 8000:8000 --env-file .env auth_backend`
	- Container entrypoint runs `uvicorn auth_backend.auth_service:app --host 0.0.0.0 --port 8000` as defined in [auth_backend/Dockerfile](auth_backend/Dockerfile).
- Generic backend ([backend](backend)):
	- Build image: `docker build -t side_backend ./backend`
	- Run container: `docker run -p 8000:8000 side_backend`
	- Serves the demo FastAPI app from [backend/main.py](backend/main.py).
- Auth frontend ([auth_frontend](auth_frontend)):
	- Build image: `docker build -t auth_frontend ./auth_frontend`
	- Run container: `docker run -p 3000:3000 -e REACT_APP_API_BASE_URL=https://api.degrand.is auth_frontend`
	- Dockerfile builds the Vite app then runs `npm run start` listening on port 3000; see [auth_frontend/Dockerfile](auth_frontend/Dockerfile).
- Budget frontend ([budget_frontend](budget_frontend)):
	- Build image: `docker build -t budget_frontend ./budget_frontend`
	- Run container: `docker run -p 3001:3001 -e REACT_APP_API_BASE_URL=https://api.degrand.is budget_frontend`
	- Dockerfile builds the Vite app then runs `npm run start` on port 3001; see [budget_frontend/Dockerfile](budget_frontend/Dockerfile).
- Trivia app ([trivia](trivia)):
	- Build image: `docker build -t trivia ./trivia`
	- Run container: `docker run -p 3002:3002 -e NODE_ENV=production trivia`
	- Dockerfile builds the Next.js app and runs the custom server with Socket.IO via `npm run start` on port 3002; see [trivia/Dockerfile](trivia/Dockerfile) and [trivia/server.ts](trivia/server.ts).
- Generic starter frontend ([frontend](frontend)):
	- Build image: `docker build -t starter_frontend ./frontend`
	- Run container (if wired into compose or manually): `docker run -p 3002:3000 starter_frontend` (adjust host port as needed).
- Nginx reverse proxy ([nginx](nginx)):
	- Build image: `docker build -t side_nginx ./nginx`
	- Run container: `docker run -p 80:80 -p 443:443 side_nginx`
	- Production deployments normally use the nginx service defined in [docker-compose.yaml](docker-compose.yaml).

## Logging, Security, and Conventions
- The auth backend logs to a file under `./logs` in development and `/app/logs` in production; log initialization and formatting is centralized at the top of [auth_backend/auth_service.py](auth_backend/auth_service.py).
- All auth-protected endpoints use `get_current_user` from [auth_backend/auth_service.py](auth_backend/auth_service.py), which reads the `access_token` cookie and validates it with the RSA public key; new protected routes should depend on this helper.
- Login sets an HTTP-only `access_token` cookie with `secure` tied to `RUNNING_ENV` and `domain` from `COOKIE_DOMAIN`; match this pattern if you adjust cookie behavior.
- SQLAlchemy sessions are created via `SessionLocal` in [auth_backend/db_connection.py](auth_backend/db_connection.py); always use this factory and `try/finally` blocks to ensure sessions are closed and transactions committed/rolled back.
- The primary user table is `user_info` with columns defined in [auth_backend/UserModel.py](auth_backend/UserModel.py); align any new queries or migrations with these field names.

## Frontend Patterns
- All frontends are standard React + TypeScript + Vite setups; base Vite configuration is in each apps [vite.config.ts](auth_frontend/vite.config.ts), [budget_frontend/vite.config.ts](budget_frontend/vite.config.ts), and [frontend/vite.config.ts](frontend/vite.config.ts).
- TypeScript configuration for app vs. tooling is split between [tsconfig.app.json](auth_frontend/tsconfig.app.json) and [tsconfig.node.json](auth_frontend/tsconfig.node.json) (same pattern in other frontends); follow this when adding new TS config.
- Frontend code is organized under `src` with `layouts`, `pages`, and `services` in [auth_frontend/src](auth_frontend/src) (e.g., API helpers in [auth_frontend/src/services/apicalls.tsx](auth_frontend/src/services/apicalls.tsx)); keep new components within these folders instead of introducing new top-level structures.
- Frontends reach the API through a base URL env var (`REACT_APP_API_BASE_URL`) set per-service in [docker-compose.yaml](docker-compose.yaml#L15-L34); any new API calls should derive their base URL from this configuration.

## How to Extend Safely
- When adding new auth features (e.g., password reset, roles), implement DB access via [auth_backend/db_connection.py](auth_backend/db_connection.py) and surface endpoints in [auth_backend/auth_service.py](auth_backend/auth_service.py) using the existing patterns for JWTs, cookies, and logging.
- When adding new tables or columns, update [auth_backend/UserModel.py](auth_backend/UserModel.py) or create new SQLAlchemy models, and ensure the schema change is reflected in [postgres/init-scripts/schema.sql](postgres/init-scripts/schema.sql).
- New protected endpoints must depend on `get_current_user` and should return simple JSON payloads consistent with existing responses (e.g., `{"message": ..., "payload": ...}` in `/verify-token`).
- For new front-end pages that require auth, call the existing `/login` and `/verify-token` flows, and expect the token to be stored in the `access_token` cookie rather than in local storage.

## Agent Scope
- Prefer small, focused changes that respect current structure rather than large refactors.
- Do not introduce new languages or frameworks beyond FastAPI, SQLAlchemy, Postgres, React, TypeScript, Vite, bcrypt, and PyJWT without explicit request.
- Before changing environment variables, Docker config, or database schema, update all affected services (auth backend, frontends, and Postgres init scripts) to keep them in sync.

## GitHub Actions / CI-CD
- The main workflow is [ .github/workflows/deploy.yml ](.github/workflows/deploy.yml), triggered on pushes to `master`.
- Steps:
	- Check out the repository with `actions/checkout@v4`.
	- Log in to Docker Hub using `docker/login-action@v3` and the `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` secrets.
	- Build all images defined in [docker-compose.yaml](docker-compose.yaml) with `docker compose build --no-cache`.
	- Push all built images to Docker Hub via `docker compose push`.
	- Create a `.env` file in the workspace using `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_PUBLIC_KEY`, and `RUNNING_ENV=production` from GitHub Secrets.
	- Copy `docker-compose.yaml`, the generated `.env`, and the [postgres](postgres) directory to the EC2 instance under `/home/${EC2_USER}/docker` using `appleboy/scp-action`.
	- Connect to the EC2 instance via `appleboy/ssh-action` and run:
		- `docker-compose down`
		- `docker image prune -f`
		- `docker-compose up --pull always -d`
- Any structural changes to services, image names, or required env vars should be mirrored in both [docker-compose.yaml](docker-compose.yaml) and the deploy workflow to keep local/dev and CI/CD behavior aligned.