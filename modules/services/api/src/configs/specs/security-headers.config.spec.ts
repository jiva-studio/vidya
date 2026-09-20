import SecurityHeadersConfig from '@vidya/api/configs/security-headers.config'

describe('security headers config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.VIDYA_HSTS_ENABLED
  })

  afterAll(() => {
    process.env = env
  })

  it('leaves HSTS off when nothing says TLS terminates in front of the API', () => {
    expect(SecurityHeadersConfig().hstsEnabled).toBe(false)
  })

  it('turns HSTS on only when a deployment says so explicitly', () => {
    process.env.VIDYA_HSTS_ENABLED = 'true'

    expect(SecurityHeadersConfig().hstsEnabled).toBe(true)
  })

  it('treats anything other than the literal "true" as off', () => {
    process.env.VIDYA_HSTS_ENABLED = 'yes'

    expect(SecurityHeadersConfig().hstsEnabled).toBe(false)
  })
})
