/**
 * Everything the admin reads from its environment, in one place.
 *
 * The API serves no CORS headers, so in development the requests go to this
 * origin under `/api` and the dev server forwards them.
 */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
} as const
