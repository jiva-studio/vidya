import { registerAs } from '@nestjs/config'
import * as ms from 'ms'

type StringValue = ms.StringValue

// `jsonwebtoken` types `expiresIn` as the `ms` template literal ('15d', '90d'), but the
// environment hands us a plain string, so the cast is where deployment vouches for the value.
const duration = (value: string | undefined, fallback: StringValue): StringValue =>
  (value as StringValue) || fallback

/**
 * The access token is short because it carries the user's permissions: revoking
 * a role only takes effect when the token is next minted. The refresh token is
 * long because it is what keeps an offline student signed in — a device can go
 * weeks without a network, and coming back to a forced sign-in would strand
 * whatever is waiting in the outbox.
 *
 * The refresh token must always outlive the access token. The other way round
 * leaves a window where the session cannot be renewed but is not yet dead, and
 * ends in a sign-out with no way back.
 */
export default registerAs('jwt', () => {
  const accessTokenExpiresIn = duration(process.env.VIDYA_JWT_ACCESS_TOKEN_EXPIRES_IN, '1h')
  const refreshTokenExpiresIn = duration(process.env.VIDYA_JWT_REFRESH_TOKEN_EXPIRES_IN, '90d')

  if (ms(refreshTokenExpiresIn) <= ms(accessTokenExpiresIn)) {
    throw new Error(
      `Refresh token lifetime (${refreshTokenExpiresIn}) must outlive the access token ` +
        `(${accessTokenExpiresIn}); otherwise sessions cannot be renewed before they expire.`,
    )
  }

  const secret = process.env.VIDYA_JWT_SECRET

  // The signing key is the whole of the authorisation model: the access token
  // carries the caller's permissions, and the guard trusts that claim without
  // re-reading the database when it is present. A missing secret must not fall
  // back to a literal — that is a key published in the source tree — and it
  // must not fall back to one generated at boot either: with more than one
  // replica each process would mint its own key, so a token issued by one
  // would be rejected by every other, and a deployment would look randomly
  // broken instead of cleanly broken. Refusing to start is the only fallback
  // that fails loud instead of failing open.
  if (!secret) {
    throw new Error(
      'VIDYA_JWT_SECRET is not set; the API refuses to start rather than sign tokens with a ' +
        'well-known or generated key.',
    )
  }

  // The floor HS256 needs to resist brute-forcing the key itself.
  if (secret.length < 32) {
    throw new Error(
      `VIDYA_JWT_SECRET is ${secret.length} characters; it must be at least 32 so HS256 has a ` +
        'key an attacker cannot feasibly brute-force.',
    )
  }

  return {
    secret,
    accessTokenExpiresIn,
    refreshTokenExpiresIn,
  }
})
