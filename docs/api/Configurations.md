# Api Service Configurations

## Environment Variables

#### `VIDYA_AUTH_USER_PERMISSIONS_CACHE_TTL`.
Time to live for the user permissions cache in seconds. Set to 0 to disable
caching, for development for example.

Every token now carries the holder's permissions, so this cache is read only
for a token minted by an older build that has not expired yet. Permissions are
fixed for the life of an access token and change at the next refresh.

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
Defaults to `5173`, Vite's own default.
