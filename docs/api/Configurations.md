# Api Service Configurations

## Environment Variables

#### `VIDYA_JWT_SECRET`

The key the API signs and verifies access and refresh tokens with. Required, at least 32 characters (the floor for HS256), and shared across every replica of the API — the process refuses to start without it rather than fall back to a well-known key or generate one at boot, either of which would make the auth model trivial to forge or replica-specific. See `docs/Development Environment.md` for the local dev value.

#### `VIDYA_AUTH_USER_PERMISSIONS_CACHE_TTL`.
Time to live for the user permissions cache in seconds. Set to 0 to disable caching for development purposes for example.

Permissions are minted into every token, so this covers the reads that mint one — signing in and refreshing — and the tokens issued before the claim existed, which the guard resolves per request.

#### `VIDYA_CORS_ORIGINS`.
Comma-separated list of browser origins allowed to read an answer from this API.
Required in every deployment: the student app is cross-origin by construction,
and the list is never a wildcard because the answers carry a student's own rows.

- The native build is always allowed and is not listed here. Capacitor serves
  the app from `capacitor://localhost` on iOS and from `http://localhost` on
  Android; both describe the client runtime rather than a host, so they hold on
  every deployment.
- When the variable is unset the API falls back to the local stand — the admin
  console on `VIDYA_ADMIN_PORT` and the mobile dev server on
  `VIDYA_MOBILE_PORT`, each under both `localhost` and `127.0.0.1`, since a
  browser sends whichever of the two is in the address bar. The fallback is
  announced on startup so a deployment cannot rely on it unnoticed.

#### `VIDYA_MOBILE_PORT`.
Port the mobile dev server runs on, used only to build the CORS fallback above.
