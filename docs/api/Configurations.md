# Api Service Configurations

## Environment Variables

#### `VIDYA_AUTH_USER_PERMISSIONS_CACHE_TTL`.
Time to live for the user permissions cache in seconds. Set to 0 to disable caching for development purposes for example.

Permissions are minted into every token, so this covers the reads that mint one — signing in and refreshing — and the tokens issued before the claim existed, which the guard resolves per request.
