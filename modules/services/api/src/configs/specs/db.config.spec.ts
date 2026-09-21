import DbConfig from '@vidya/api/configs/db.config'

describe('db config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })

  afterAll(() => {
    process.env = env
  })

  it('keeps query logging off when the variable is unset', () => {
    delete process.env.VIDYA_DB_LOGGING

    expect(DbConfig().logging).toBe(false)
  })

  it('turns query logging on when explicitly requested', () => {
    process.env.VIDYA_DB_LOGGING = 'true'

    expect(DbConfig().logging).toBe(true)
  })

  it('keeps query logging off for any other value', () => {
    process.env.VIDYA_DB_LOGGING = 'false'

    expect(DbConfig().logging).toBe(false)
  })

  it('provides sensible pool size defaults for production', () => {
    const config = DbConfig()

    expect(config.poolSize).toBe(20)
    expect(config.minPoolSize).toBe(2)
    expect(config.idleTimeoutMillis).toBe(30000)
    expect(config.connectionTimeoutMillis).toBe(5000)
    expect(config.ssl).toBe(false)
  })

  it('honors environment overrides for pool and ssl', () => {
    process.env.VIDYA_DB_POOL_MAX = '50'
    process.env.VIDYA_DB_POOL_MIN = '10'
    process.env.VIDYA_DB_SSL = 'true'
    process.env.VIDYA_DB_SSL_REJECT_UNAUTHORIZED = 'true'

    const config = DbConfig()

    expect(config.poolSize).toBe(50)
    expect(config.minPoolSize).toBe(10)
    expect(config.ssl).toEqual({ rejectUnauthorized: true })
  })
})
