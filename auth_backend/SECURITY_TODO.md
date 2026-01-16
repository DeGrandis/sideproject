# Auth Backend Security TODOs

This file tracks known security issues and hardening tasks for the auth backend service.

## Logging & Sensitive Data
- Stop logging raw request bodies on `/login` in [auth_backend/auth_service.py](auth_backend/auth_service.py); never log passwords or other credentials.
- Remove or mask logging of full `access_token` values in `get_current_user`, `/login`, and `/verify-token` in [auth_backend/auth_service.py](auth_backend/auth_service.py); log only minimal metadata (e.g., user id, token hash, or truncated token).

## Session & CSRF Protection
- Review cookie-based auth using the `access_token` cookie in [auth_backend/auth_service.py](auth_backend/auth_service.py) for CSRF exposure.
- If the app makes authenticated browser requests that can be triggered cross-site, add a CSRF defense (e.g., double-submit token or SameSite=Strict plus explicit CSRF token for unsafe methods).

## Password Policy & Account Creation
- Strengthen password policy in `/create-account` in [auth_backend/auth_service.py](auth_backend/auth_service.py): consider checks for breached/common passwords and/or stronger complexity rules.
- Reduce user enumeration risk in `/create-account` by avoiding distinct error messages for "Email already exists" vs. "Username already exists"; use a generic failure message while logging specifics server-side.

## Brute Force & Abuse Controls
- Add basic rate limiting or backoff for `/login` and `/create-account` in [auth_backend/auth_service.py](auth_backend/auth_service.py) (IP-based and/or account-based) to mitigate credential stuffing and brute force.
- Consider temporary account lockout or captcha after repeated failed login attempts.

### Planned: Add Rate Limiting to /login
- Evaluate FastAPI-compatible rate limiting libraries (e.g., `slowapi`, `fastapi-limiter`, or custom middleware).
- Target: Add IP-based rate limiting to the `/login` endpoint in [auth_backend/auth_service.py](auth_backend/auth_service.py).
- Example: Limit to 5 login attempts per minute per IP address; return HTTP 429 on excess.
- Implementation steps:
	1. Add dependency to requirements.txt (e.g., `slowapi` or `fastapi-limiter`).
	2. Initialize rate limiter in app setup.
	3. Decorate `/login` endpoint with rate limit decorator or add logic in handler.
	4. Log rate limit events and test with repeated requests.
- Consider future extension to account-based rate limiting and lockout after repeated failures.

## JWT Validation & Claims
- Extend JWT validation in `get_current_user` and `/verify-token` in [auth_backend/auth_service.py](auth_backend/auth_service.py) to optionally enforce additional claims where appropriate (e.g., `aud`, `iss`, `nbf`).
- Document token lifetime and refresh strategy; ensure `ACCESS_TOKEN_EXPIRE_MINUTES` is appropriate for production.

## Authorization Code Handling
- Add expiration and cleanup for entries in `redirect_authorization_codes` in [auth_backend/auth_service.py](auth_backend/auth_service.py).
- Consider persisting authorization codes in a shared store (DB/redis) if multiple auth_backend instances will run, instead of an in-memory dict.

## Database Access
- Tighten `does_user_field_exist` in [auth_backend/db_connection.py](auth_backend/db_connection.py) to only accept a fixed set of allowed fields (e.g., email, username) instead of arbitrary attribute names.
- Review `DATABASE_URL` in [auth_backend/db_connection.py](auth_backend/db_connection.py) for TLS usage; add SSL options if the database is ever accessed over non-local networks.

## Container Hardening
- Update [auth_backend/Dockerfile](auth_backend/Dockerfile) to run the FastAPI app as a non-root user inside the container.
- Ensure file permissions on the `/app/logs` directory are limited to the app user and that log files dont leak outside the container unintentionally.
