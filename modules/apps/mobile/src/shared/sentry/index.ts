import * as Sentry from '@sentry/vue'
import type { App } from 'vue'
import type { Router } from 'vue-router'

export interface SentryMobileUserContext {
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

  const integrations: NonNullable<Parameters<typeof Sentry.init>[0]>['integrations'] = [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ]

  if (router) {
    integrations.push(Sentry.browserTracingIntegration({ router }))
  }

  Sentry.init({
    app,
    dsn,
    environment: import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE || 'development',
    release: import.meta.env.VITE_APP_VERSION,
    integrations,
    tracesSampleRate: Number(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? (import.meta.env.PROD ? 0.1 : 1.0),
    ),
    replaysSessionSampleRate: Number(
      import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? 0.0,
    ),
    replaysOnErrorSampleRate: Number(
      import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? 1.0,
    ),
  })

  isSentryInitialized = true
  return true
}

export const isSentryEnabled = (): boolean => isSentryInitialized

export const setSentryUser = (user: SentryMobileUserContext | null): void => {
  if (!isSentryInitialized) return
  Sentry.setUser(user ? { id: user.id, email: user.email, schoolId: user.schoolId } : null)
}

export const captureMobileException = (
  error: unknown,
  context?: Record<string, unknown>,
): string | undefined => {
  if (!isSentryInitialized) return undefined
  return Sentry.captureException(error, {
    extra: context,
  })
}

export const addMobileBreadcrumb = (breadcrumb: Sentry.Breadcrumb): void => {
  if (!isSentryInitialized) return
  Sentry.addBreadcrumb(breadcrumb)
}
