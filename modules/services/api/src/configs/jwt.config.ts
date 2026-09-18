import { registerAs } from '@nestjs/config'
import type { StringValue } from 'ms'

// `jsonwebtoken` types `expiresIn` as `number | StringValue`, where StringValue is
// the `ms` template literal type ('15d', '7d', ...). Reading it from the
// environment yields a plain string, so the cast is where we accept that the
// value is validated by deployment rather than by the compiler.
const duration = (value: string | undefined, fallback: StringValue): StringValue =>
  (value as StringValue) || fallback

export default registerAs('jwt', () => ({
  secret: process.env.VIDYA_JWT_SECRET || 'secret',
  accessTokenExpiresIn: duration(process.env.VIDYA_JWT_ACCESS_TOKEN_EXPIRES_IN, '15d'),
  refreshTokenExpiresIn: duration(process.env.VIDYA_JWT_REFRESH_TOKEN_EXPIRES_IN, '7d'),
}))
