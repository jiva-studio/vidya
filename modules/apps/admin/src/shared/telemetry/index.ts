import type * as SentryType from '@sentry/vue'
import type { App } from 'vue'
import type { Router } from 'vue-router'

import { config } from '../config'

export interface SentryUserContext {
  id?: string
  email?: string
  schoolId?: string
}

let SentryInstance: typeof SentryType | null = null
let isSentryInitialized = false

export const initSentry = async (app: App, router?: Router): Promise<boolean> => {
  const dsn = config.sentry.dsn
  if (!dsn) {
    return false
  }

  const Sentry = await import('@sentry/vue')
  SentryInstance = Sentry

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
    environment: config.sentry.environment,
    release: config.sentry.release,
    integrations,
    tracesSampleRate: config.sentry.tracesSampleRate,
    replaysSessionSampleRate: config.sentry.replaysSessionSampleRate,
    replaysOnErrorSampleRate: config.sentry.replaysOnErrorSampleRate,
  })

  isSentryInitialized = true
  return true
}

export const isSentryEnabled = (): boolean => isSentryInitialized

export const setSentryUser = (user: SentryUserContext | null): void => {
  if (!isSentryInitialized || !SentryInstance) return
  SentryInstance.setUser(user ? { id: user.id, email: user.email, schoolId: user.schoolId } : null)
}

export const captureAdminException = (
  error: unknown,
  context?: Record<string, unknown>,
): string | undefined => {
  if (!isSentryInitialized || !SentryInstance) return undefined
  return SentryInstance.captureException(error, {
    extra: context,
  })
}

export const addAdminBreadcrumb = (breadcrumb: SentryType.Breadcrumb): void => {
  if (!isSentryInitialized || !SentryInstance) return
  SentryInstance.addBreadcrumb(breadcrumb)
}
