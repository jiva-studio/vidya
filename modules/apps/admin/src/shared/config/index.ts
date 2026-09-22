/**
 * Everything the admin reads from its environment, in one place.
 *
 * The API serves no CORS headers, so in development the requests go to this
 * origin under `/api` and the dev server forwards them.
 *
 * The student site is a different origin — its own `localStorage`, its own
 * database. A joining link is built from the console's own address where the
 * naming allows it, and `studentBaseUrl` answers where it does not: a console
 * on a bare host, development among them. The default is the development port.
 */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  studentBaseUrl: import.meta.env.VITE_STUDENT_BASE_URL || 'http://localhost:7814',
} as const
