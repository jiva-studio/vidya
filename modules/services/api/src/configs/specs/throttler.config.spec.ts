import { throttlerSettings } from '@vidya/api/configs/throttler.config'

describe('throttler config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.VIDYA_THROTTLE_DEFAULT_LIMIT
    delete process.env.VIDYA_THROTTLE_SYNC_LIMIT
    delete process.env.VIDYA_THROTTLE_SIGNIN_LOGIN_LIMIT
    delete process.env.VIDYA_THROTTLE_SIGNIN_IP_LIMIT
    delete process.env.VIDYA_THROTTLE_OTP_DESTINATION_LIMIT
    delete process.env.VIDYA_THROTTLE_OTP_IP_LIMIT
    delete process.env.VIDYA_THROTTLE_REFRESH_LIMIT
  })

  afterAll(() => {
    process.env = env
  })

  it('matches the table for every route', () => {
    const settings = throttlerSettings()

    expect(settings.signin.loginLimit).toBe(5)
    expect(settings.otp.destinationLimit).toBe(3)
    expect(settings.refresh.limit).toBe(20)
  })

  it('reads a configured count over the default', () => {
    process.env.VIDYA_THROTTLE_SIGNIN_LOGIN_LIMIT = '9'

    expect(throttlerSettings().signin.loginLimit).toBe(9)
  })

  it('falls back to the default for a count that is not a positive integer', () => {
    process.env.VIDYA_THROTTLE_OTP_DESTINATION_LIMIT = 'not-a-number'

    expect(throttlerSettings().otp.destinationLimit).toBe(3)
  })

  it('gives the IP dimension more headroom than the login/destination dimension', () => {
    const settings = throttlerSettings()

    expect(settings.signin.ipLimit).toBeGreaterThan(settings.signin.loginLimit)
    expect(settings.otp.ipLimit).toBeGreaterThan(settings.otp.destinationLimit)
  })

  it('gives sync more headroom than the global default', () => {
    const settings = throttlerSettings()

    expect(settings.sync.limit).toBeGreaterThan(settings.default.limit)
  })
})
