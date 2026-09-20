import { registerAs } from '@nestjs/config'

/**
 * Whether the API sends `Strict-Transport-Security`.
 *
 * HSTS is a promise made on behalf of whatever terminates TLS in front of this
 * process. `modules/services/gateway/` can be that, but whether a given
 * deployment runs it, and with TLS on, is not something this repo can see.
 * Sending the header regardless would tell a browser to remember TLS-only for
 * a year against a host that may not offer it, which locks a visitor out
 * rather than protecting them. A deployment terminating TLS turns this on with
 * `VIDYA_HSTS_ENABLED=true`; the default stays off.
 */
export default registerAs('securityHeaders', () => ({
  hstsEnabled: process.env.VIDYA_HSTS_ENABLED === 'true',
}))
