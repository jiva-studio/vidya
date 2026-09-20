import TrustProxyConfig from '@vidya/api/configs/trust-proxy.config'

describe('trust proxy config', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.VIDYA_TRUST_PROXY
  })

  afterAll(() => {
    process.env = env
  })

  it('trusts nothing by default, so a request behind an unconfigured proxy keeps its own IP', () => {
    expect(TrustProxyConfig().setting).toBe(false)
  })

  it('reads a hop count as a number, not a string', () => {
    process.env.VIDYA_TRUST_PROXY = '1'

    expect(TrustProxyConfig().setting).toBe(1)
  })

  it('trusts every hop when told to explicitly', () => {
    process.env.VIDYA_TRUST_PROXY = 'true'

    expect(TrustProxyConfig().setting).toBe(true)
  })

  it('treats the literal "false" as off, same as unset', () => {
    process.env.VIDYA_TRUST_PROXY = 'false'

    expect(TrustProxyConfig().setting).toBe(false)
  })

  it('passes a list of addresses through as Express expects it', () => {
    process.env.VIDYA_TRUST_PROXY = '10.0.0.0/8,loopback'

    expect(TrustProxyConfig().setting).toBe('10.0.0.0/8,loopback')
  })
})
