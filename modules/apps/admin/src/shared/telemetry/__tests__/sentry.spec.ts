import * as Sentry from '@sentry/vue'
import { describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'

import {
  addAdminBreadcrumb,
  captureAdminException,
  initSentry,
  isSentryEnabled,
  setSentryUser,
} from '../index'

vi.mock('@sentry/vue', () => ({
  init: vi.fn(),
  setUser: vi.fn(),
  captureException: vi.fn(() => 'event-123'),
  addBreadcrumb: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({})),
  replayIntegration: vi.fn(() => ({})),
}))

describe('admin sentry integration', () => {
  it('does not initialize when VITE_SENTRY_DSN is absent', async () => {
    const mockApp = {} as App
    const initialized = await initSentry(mockApp)

    expect(initialized).toBe(false)
    expect(isSentryEnabled()).toBe(false)
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('initializes and configures Sentry when VITE_SENTRY_DSN is present', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://mock@sentry.io/456')
    const mockApp = {} as App
    const initialized = await initSentry(mockApp)

    expect(initialized).toBe(true)
    expect(isSentryEnabled()).toBe(true)
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        app: mockApp,
        dsn: 'https://mock@sentry.io/456',
      }),
    )
  })

  it('forwards user context to Sentry', () => {
    setSentryUser({ id: 'user-1', email: 'admin@vidya.com' })
    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'admin@vidya.com',
      schoolId: undefined,
    })
  })

  it('captures exceptions to Sentry', () => {
    const err = new Error('Component crashed')
    const eventId = captureAdminException(err, { component: 'CourseEditor' })

    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      extra: { component: 'CourseEditor' },
    })
    expect(eventId).toBe('event-123')
  })

  it('adds breadcrumbs to Sentry', () => {
    addAdminBreadcrumb({ message: 'Navigation to /schools', category: 'navigation' })
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: 'Navigation to /schools',
      category: 'navigation',
    })
  })
})
