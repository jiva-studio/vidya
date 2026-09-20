import { registerAs } from '@nestjs/config'

/** What Express's `trust proxy` setting accepts; see `main.ts`. */
export type TrustProxySetting = boolean | number | string

const parse = (value: string | undefined): TrustProxySetting => {
  if (!value) return false
  if (value === 'true') return true
  if (value === 'false') return false

  const hops = Number(value)
  // A literal integer string ("1", "2") means hop count. Anything else is
  // passed through as-is: Express also accepts a comma-separated list of
  // trusted addresses or subnets ("loopback", "10.0.0.0/8").
  return Number.isInteger(hops) && String(hops) === value ? hops : value
}

/**
 * Who this process trusts to have already resolved the caller's real IP.
 *
 * Per-IP throttling reads `req.ip`, and Express only strips proxy hops out of
 * `X-Forwarded-For` when told to. Left at the default `false`, a request
 * behind any reverse proxy or load balancer arrives with `req.ip` pointing at
 * that proxy — every caller behind it then shares one IP bucket, and the
 * per-IP limits stop meaning anything.
 *
 * A deployment that puts a proxy in front sets `VIDYA_TRUST_PROXY` to the
 * number of hops it terminates before this process — `1` for a single load
 * balancer — once that proxy is actually there. Trusting `X-Forwarded-For`
 * unconditionally (`VIDYA_TRUST_PROXY=true`, "trust every hop") is supported
 * because Express supports it, not because it is what a deployment should
 * reach for: that header is caller-supplied, and trusting it without a real
 * proxy in front lets anyone forge their way past every per-IP limit by
 * setting it themselves.
 */
export default registerAs('trustProxy', () => ({ setting: parse(process.env.VIDYA_TRUST_PROXY) }))
