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
 * The refresh token must always outlive the access token. The other way round —
 * which is what this file used to say, at 15d access against 7d refresh — leaves
 * a window where the session cannot be renewed but is not yet dead, and ends in
 * a sign-out with no way back.
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

  return {
    secret: process.env.VIDYA_JWT_SECRET || 'secret',
    accessTokenExpiresIn,
    refreshTokenExpiresIn,
  }
})
