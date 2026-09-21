/**
 * Everything the site reads from its environment, in one place.
 *
 * The API serves no CORS headers, and it does not have to: the site and the
 * API answer on the same origin — the dev server forwards `/api`, the gateway
 * serves it — so there is one address here and it is a path.
 */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
} as const
