import MediaConfig from '@vidya/api/configs/media.config'

describe('media config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.VIDYA_MEDIA_MASTER_KEY
    delete process.env.VIDYA_MEDIA_MASTER_KEY_VERSION
    delete process.env.VIDYA_MEDIA_ENDPOINT_ALLOWLIST
    delete process.env.VIDYA_MEDIA_MAX_IMAGE_BYTES
    delete process.env.VIDYA_MEDIA_DEFAULT_QUOTA_BYTES
  })

  afterAll(() => {
    process.env = env
  })

  it('starts without a master key, because nothing is sealed until a school hands over keys', () => {
    expect(MediaConfig().masterKey).toBeNull()
  })

  it('reads a key of thirty-two bytes from base64', () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = Buffer.alloc(32, 7).toString('base64')

    expect(MediaConfig().masterKey).toEqual(Buffer.alloc(32, 7))
  })

  it('refuses a key too short for AES-256, naming the variable', () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = Buffer.alloc(16, 7).toString('base64')

    expect(() => MediaConfig()).toThrow(/VIDYA_MEDIA_MASTER_KEY/)
  })

  it('refuses a key too long for AES-256 as well, not only a short one', () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = Buffer.alloc(48, 7).toString('base64')

    expect(() => MediaConfig()).toThrow(/VIDYA_MEDIA_MASTER_KEY/)
  })

  it('always trusts the providers we drive, whatever the installation adds', () => {
    expect(MediaConfig().endpointAllowlist).toEqual(
      expect.arrayContaining(['amazonaws.com', 'storage.bunnycdn.com', 'r2.cloudflarestorage.com']),
    )
  })

  it('takes further endpoint suffixes from deployment, spaces and dots and all', () => {
    process.env.VIDYA_MEDIA_ENDPOINT_ALLOWLIST = ' .minio.internal, Storage.Example '

    expect(MediaConfig().endpointAllowlist).toEqual(
      expect.arrayContaining(['minio.internal', 'storage.example']),
    )
  })

  it('adds nothing when deployment names nothing', () => {
    process.env.VIDYA_MEDIA_ENDPOINT_ALLOWLIST = ' , ,'

    expect(MediaConfig().endpointAllowlist).toHaveLength(3)
  })

  it('carries the upload ceilings and the quota of the default storage', () => {
    const config = MediaConfig()

    expect(config.maxImageBytes).toBe(10_485_760)
    expect(config.maxAudioBytes).toBe(209_715_200)
    expect(config.maxVideoBytes).toBe(2_147_483_648)
    expect(config.defaultQuotaBytes).toBe(5_368_709_120)
  })

  it('lets deployment move a ceiling', () => {
    process.env.VIDYA_MEDIA_MAX_IMAGE_BYTES = '1024'

    expect(MediaConfig().maxImageBytes).toBe(1024)
  })

  it('keeps the default when deployment sets a ceiling to something that is not a size', () => {
    process.env.VIDYA_MEDIA_MAX_IMAGE_BYTES = 'plenty'

    expect(MediaConfig().maxImageBytes).toBe(10_485_760)
  })
})
