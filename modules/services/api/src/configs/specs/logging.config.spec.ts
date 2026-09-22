import LoggingConfig from '@vidya/api/configs/logging.config'

describe('logging config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })

  afterAll(() => {
    process.env = env
  })

  it('defaults to debug and pretty in development mode', () => {
    delete process.env.NODE_ENV
    delete process.env.VIDYA_LOG_LEVEL
    delete process.env.VIDYA_LOG_FORMAT

    const config = LoggingConfig()

    expect(config.level).toBe('debug')
    expect(config.format).toBe('pretty')
  })

  it('defaults to info and json in production mode', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.VIDYA_LOG_LEVEL
    delete process.env.VIDYA_LOG_FORMAT

    const config = LoggingConfig()

    expect(config.level).toBe('info')
    expect(config.format).toBe('json')
  })

  it('honors explicit environment overrides', () => {
    process.env.VIDYA_LOG_LEVEL = 'warn'
    process.env.VIDYA_LOG_FORMAT = 'json'

    const config = LoggingConfig()

    expect(config.level).toBe('warn')
    expect(config.format).toBe('json')
  })
})
