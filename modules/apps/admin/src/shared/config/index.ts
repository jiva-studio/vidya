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
  baseUrl: import.meta.env.BASE_URL,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  studentBaseUrl: import.meta.env.VITE_STUDENT_BASE_URL || 'http://localhost:7814',
  sentry: {
    get dsn() {
      return import.meta.env.VITE_SENTRY_DSN
    },
    get environment() {
      return import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE || 'development'
    },
    get release() {
      return import.meta.env.VITE_APP_VERSION
    },
    get tracesSampleRate() {
      return Number(
        import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? (import.meta.env.PROD ? 0.1 : 1.0),
      )
    },
    get replaysSessionSampleRate() {
      return Number(
        import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? 0.0,
      )
    },
    get replaysOnErrorSampleRate() {
      return Number(
        import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? 1.0,
      )
    },
  },
} as const
