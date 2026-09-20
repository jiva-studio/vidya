import OtpConfig from '@vidya/api/configs/otp.config'

describe('otp config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.VIDYA_OTP_ALPHABET
    delete process.env.VIDYA_OTP_LENGTH
  })

  afterAll(() => {
    process.env = env
  })

  it('defaults to a numeric code long enough to resist brute-forcing within the OTP lifetime', () => {
    const config = OtpConfig()

    expect(config.alphabet).toBe('0123456789')
    expect(config.length).toBe(8)
    expect(config.alphabet.length ** config.length).toBeGreaterThanOrEqual(1e8)
  })

  it('lets a deployment override the alphabet and length', () => {
    process.env.VIDYA_OTP_ALPHABET = 'AB'
    process.env.VIDYA_OTP_LENGTH = '4'

    const config = OtpConfig()

    expect(config.alphabet).toBe('AB')
    expect(config.length).toBe(4)
  })
})
