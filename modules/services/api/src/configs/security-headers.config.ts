import { registerAs } from '@nestjs/config'

/**
 * Whether the API sends `Strict-Transport-Security`.
 *
 * HSTS is a promise made on behalf of whatever terminates TLS in front of this
 * process, and today nothing does: `modules/services/gateway/` is an empty
 * README, so a request reaching this process has already arrived in plaintext
 * or the hop is a deployment's own concern this repo cannot see. Sending the
 * header anyway would tell a browser to remember TLS-only for a year against a
 * host that may not offer it, which locks a visitor out rather than protecting
 * them. A deployment that puts TLS in front turns this on with
 * `VIDYA_HSTS_ENABLED=true`; the default stays off.
 */
export default registerAs('securityHeaders', () => ({
  hstsEnabled: process.env.VIDYA_HSTS_ENABLED === 'true',
}))
