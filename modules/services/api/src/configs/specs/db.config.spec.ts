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
})
