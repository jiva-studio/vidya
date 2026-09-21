import SentryConfig from '@vidya/api/configs/sentry.config'

describe('sentry config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })

  afterAll(() => {
    process.env = env
  })

  it('is disabled when DSN is not provided', () => {
    delete process.env.VIDYA_SENTRY_DSN
    delete process.env.SENTRY_DSN

    const config = SentryConfig()

    expect(config.enabled).toBe(false)
    expect(config.dsn).toBe('')
  })

  it('is enabled when DSN is present and parses options', () => {
    process.env.VIDYA_SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0'
    process.env.VIDYA_SENTRY_ENVIRONMENT = 'staging'
    process.env.VIDYA_SENTRY_RELEASE = '1.2.3'
    process.env.VIDYA_SENTRY_TRACES_SAMPLE_RATE = '0.25'

    const config = SentryConfig()

    expect(config.enabled).toBe(true)
    expect(config.dsn).toBe('https://examplePublicKey@o0.ingest.sentry.io/0')
    expect(config.environment).toBe('staging')
    expect(config.release).toBe('1.2.3')
    expect(config.tracesSampleRate).toBe(0.25)
  })
})
