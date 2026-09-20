import CorsConfig from '@vidya/api/configs/cors.config'

describe('cors config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.VIDYA_CORS_ORIGINS
    delete process.env.VIDYA_ADMIN_PORT
    delete process.env.VIDYA_MOBILE_PORT
  })

  afterAll(() => {
    process.env = env
  })

  it('always admits the native build, which has no dev server to be listed by', () => {
    process.env.VIDYA_CORS_ORIGINS = 'https://school.example'

    expect(CorsConfig().origins).toEqual(
      expect.arrayContaining(['capacitor://localhost', 'http://localhost']),
    )
  })

  it('takes the browser origins from deployment when it names them', () => {
    process.env.VIDYA_CORS_ORIGINS = 'https://admin.example, https://app.example'
    const config = CorsConfig()

    expect(config.origins).toEqual(
      expect.arrayContaining(['https://admin.example', 'https://app.example']),
    )
    expect(config.configured).toBe(true)
  })

  it('does not let the local stand in once deployment has spoken', () => {
    process.env.VIDYA_CORS_ORIGINS = 'https://admin.example'

    expect(CorsConfig().origins).not.toContain('http://localhost:7811')
  })

  it('falls back to the stand, and says that it did', () => {
    process.env.VIDYA_ADMIN_PORT = '7811'
    process.env.VIDYA_MOBILE_PORT = '5180'
    const config = CorsConfig()

    expect(config.origins).toEqual(
      expect.arrayContaining([
        'http://localhost:7811',
        'http://127.0.0.1:7811',
        'http://localhost:5180',
        'http://127.0.0.1:5180',
      ]),
    )
    expect(config.configured).toBe(false)
  })

  it('reads an empty variable as nothing said, not as nothing allowed', () => {
    process.env.VIDYA_CORS_ORIGINS = '  ,  '
    const config = CorsConfig()

    expect(config.configured).toBe(false)
    expect(config.origins).toContain('http://localhost:7811')
  })

  it('never hands out a wildcard, whatever it is told', () => {
    process.env.VIDYA_CORS_ORIGINS = 'https://admin.example'

    expect(CorsConfig().origins).not.toContain('*')
  })
})
