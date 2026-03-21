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
## OAuth2 Implementation Gaps
The current authorization code flow in [auth_backend/auth_service.py](auth_backend/auth_service.py) mimics OAuth2 but lacks critical components for secure third-party app integration:

### Missing Client Authentication
- `/issue-authorization-code` and `/redeem-authorization-code` do not verify any `client_id` or `client_secret`.
- Any logged-in user can request an authorization code and any caller can redeem it without proving they are the intended recipient.
- **Action needed**: Implement a registered client system with `client_id`, `client_secret`, and allowed `redirect_uri` patterns stored in the database.
- Validate client credentials during both authorization code issuance and redemption.

### No Scopes Implementation
- The current flow generates tokens with full user data and roles without any scope restrictions (e.g., `read:balance`, `write:transfer`).
- Third-party apps have no way to request limited permissions.
- **Action needed**: Add a `scopes` field to the authorization code flow; store requested scopes with the code, validate them during redemption, and embed only authorized scopes in the resulting access token claims.

### Improper Redirect Handling
- `/issue-authorization-code` returns the authorization code in a JSON response instead of redirecting the user's browser back to the merchant's `redirect_uri` with the code in the URL query string (standard OAuth2 pattern).
- This breaks typical OAuth2 browser flows where the user is redirected from the merchant → auth service → back to merchant.
- **Action needed**: Modify `/issue-authorization-code` to perform an HTTP 302 redirect to `redirect_uri?code=<auth_code>&state=<state>` after validating the redirect_uri against registered client settings.

### "Double Token" Security Issue
- In `issue_authorization_code()`, a **full access token** is pre-generated and stored in the `redirect_authorization_codes` dictionary using a UUID as the key.
- In standard OAuth2, the authorization code is a temporary pointer; the access token should only be created **during redemption** after client authentication.
- **Current risk**: If an attacker obtains an authorization code, they can redeem it for a token without proving they are the legitimate client.
- **Action needed**: Store only user identity and requested scopes with the authorization code; generate the access token only in `redeem_authorization_code()` after validating client credentials.

## Token Management & Lifecycle

### Token Revocation / Logout
- JWTs are stateless and cannot be revoked before their `exp` claim without additional infrastructure.
- Users have no way to "log out" or invalidate tokens early (e.g., if a device is compromised).
- **Action needed**: Implement a token blacklist using Redis or a database table; check the blacklist in `get_current_user()` before accepting a token.
- Add a `/logout` endpoint that adds the token's `jti` (JWT ID) or a hash to the blacklist with a TTL matching the token's remaining lifetime.

### Token Distribution: Cookies vs. JSON Body
- `/login` sets the access token in an HTTP-only cookie **and** returns it in the response body JSON.
- For third-party merchant apps on different domains, cookies will often fail due to CORS/SameSite restrictions.
- This creates confusion: browser-based same-domain apps should use cookies; third-party apps should receive tokens in the response body and send them via `Authorization` headers.
- **Action needed**: Clarify the intended use case:
	- If supporting same-origin browser apps: keep cookie-based auth and remove token from JSON response (or make it optional).
	- If supporting third-party OAuth2 clients: remove cookie-setting from `/login` and `/redeem-authorization-code`; rely on `Authorization: Bearer <token>` headers.
	- Consider separate endpoints or a `grant_type` parameter to distinguish between flows (e.g., `password` grant for first-party, `authorization_code` for third-party).