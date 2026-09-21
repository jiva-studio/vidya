import * as Sentry from '@sentry/vue'
import { describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'

import {
  addMobileBreadcrumb,
  captureMobileException,
  initSentry,
  isSentryEnabled,
  setSentryUser,
} from '../index'

vi.mock('@sentry/vue', () => ({
  init: vi.fn(),
  setUser: vi.fn(),
  captureException: vi.fn(() => 'event-mobile-123'),
  addBreadcrumb: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({})),
  replayIntegration: vi.fn(() => ({})),
}))

describe('mobile sentry integration', () => {
  it('does not initialize when VITE_SENTRY_DSN is absent', () => {
    const mockApp = {} as App
    const initialized = initSentry(mockApp)

    expect(initialized).toBe(false)
    expect(isSentryEnabled()).toBe(false)
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('initializes and configures Sentry when VITE_SENTRY_DSN is present', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://mock@sentry.io/789')
    const mockApp = {} as App
    const initialized = initSentry(mockApp)

    expect(initialized).toBe(true)
    expect(isSentryEnabled()).toBe(true)
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        app: mockApp,
        dsn: 'https://mock@sentry.io/789',
      }),
    )
  })

  it('forwards user context to Sentry', () => {
    setSentryUser({ id: 'student-1', email: 'student@vidya.com', schoolId: 'school-1' })
    expect(Sentry.setUser).toHaveBeenCalledWith({
      id: 'student-1',
      email: 'student@vidya.com',
      schoolId: 'school-1',
    })
  })

  it('captures exceptions to Sentry', () => {
    const err = new Error('Device sync crashed')
    const eventId = captureMobileException(err, { component: 'DeviceSync' })

    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      extra: { component: 'DeviceSync' },
    })
    expect(eventId).toBe('event-mobile-123')
  })

  it('adds breadcrumbs to Sentry', () => {
    addMobileBreadcrumb({ message: 'Sync started', category: 'sync' })
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      message: 'Sync started',
      category: 'sync',
    })
  })
})
