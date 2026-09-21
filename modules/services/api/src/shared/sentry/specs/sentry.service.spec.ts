import * as Sentry from '@sentry/node'

import { SentryService } from '../sentry.service'

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(() => 'event-id-123'),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  getActiveSpan: jest.fn(),
}))

describe('SentryService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('initializes Sentry when DSN is provided', () => {
    const service = new SentryService({
      dsn: 'https://key@sentry.io/123',
      environment: 'production',
      release: '1.0.0',
      tracesSampleRate: 0.1,
      enabled: true,
    })

    service.onModuleInit()

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@sentry.io/123',
        environment: 'production',
        release: '1.0.0',
        tracesSampleRate: 0.1,
      }),
    )
    expect(service.isEnabled()).toBe(true)
  })

  it('skips initialization when disabled / no DSN', () => {
    const service = new SentryService({
      dsn: '',
      environment: 'development',
      release: '1.0.0',
      tracesSampleRate: 1.0,
      enabled: false,
    })

    service.onModuleInit()

    expect(Sentry.init).not.toHaveBeenCalled()
    expect(service.isEnabled()).toBe(false)
  })

  it('captures exception and forwards to Sentry when enabled', () => {
    const service = new SentryService({
      dsn: 'https://key@sentry.io/123',
      environment: 'production',
      release: '1.0.0',
      tracesSampleRate: 0.1,
      enabled: true,
    })

    const err = new Error('Test crash')
    const eventId = service.captureException(err, { extra: { foo: 'bar' } })

    expect(Sentry.captureException).toHaveBeenCalledWith(err, expect.any(Function))
    expect(eventId).toBe('event-id-123')
  })
})
