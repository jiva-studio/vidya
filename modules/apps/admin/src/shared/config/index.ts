/**
 * Everything the admin reads from its environment, in one place.
 *
 * The API serves no CORS headers, so in development the requests go to this
 * origin under `/api` and the dev server forwards them.
 *
 * The student site is a different origin — its own `localStorage`, its own
 * database — so the console cannot build a joining link out of its own address
 * and is told where that site stands. The default is the development port.
 */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  studentBaseUrl: import.meta.env.VITE_STUDENT_BASE_URL || 'http://localhost:7814',
} as const
