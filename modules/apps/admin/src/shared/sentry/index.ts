import * as Sentry from '@sentry/vue'
import type { App } from 'vue'
import type { Router } from 'vue-router'

export interface SentryUserContext {
  id?: string
  email?: string
  schoolId?: string
}

let isSentryInitialized = false

export const initSentry = (app: App, router?: Router): boolean => {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    return false
  }

  Sentry.init({
    app,
    dsn,
    environment: import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE || 'development',
    release: import.meta.env.VITE_APP_VERSION,
    integrations: router ? [Sentry.browserTracingIntegration({ router })] : [],
    tracesSampleRate: Number(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? (import.meta.env.PROD ? 0.1 : 1.0),
    ),
  })

  isSentryInitialized = true
  return true
}

export const isSentryEnabled = (): boolean => isSentryInitialized

export const setSentryUser = (user: SentryUserContext | null): void => {
  if (!isSentryInitialized) return
  Sentry.setUser(user ? { id: user.id, email: user.email, schoolId: user.schoolId } : null)
}

export const captureAdminException = (
  error: unknown,
  context?: Record<string, unknown>,
): string | undefined => {
  if (!isSentryInitialized) return undefined
  return Sentry.captureException(error, {
    extra: context,
  })
}

export const addAdminBreadcrumb = (breadcrumb: Sentry.Breadcrumb): void => {
  if (!isSentryInitialized) return
  Sentry.addBreadcrumb(breadcrumb)
}
