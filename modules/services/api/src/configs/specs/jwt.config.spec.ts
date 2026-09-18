import JwtConfig from '@vidya/api/configs/jwt.config'
import * as ms from 'ms'

describe('jwt config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })

  afterAll(() => {
    process.env = env
  })

  it('gives the refresh token a longer life than the access token', () => {
    const config = JwtConfig()

    expect(ms(config.refreshTokenExpiresIn)).toBeGreaterThan(ms(config.accessTokenExpiresIn))
  })

  it('refuses a configuration where the session cannot be renewed', () => {
    process.env.VIDYA_JWT_ACCESS_TOKEN_EXPIRES_IN = '15d'
    process.env.VIDYA_JWT_REFRESH_TOKEN_EXPIRES_IN = '7d'

    expect(() => JwtConfig()).toThrow(/must outlive the access token/)
  })

  it('keeps the refresh token long enough for an offline device', () => {
    const config = JwtConfig()

    expect(ms(config.refreshTokenExpiresIn)).toBeGreaterThanOrEqual(ms('30d'))
  })
})
