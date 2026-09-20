import { registerAs } from '@nestjs/config'
import { hours, minutes } from '@nestjs/throttler'

const int = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * How many requests each rate-limited bucket admits before it answers `429`.
 *
 * Every window here is fixed, not read from the environment: it encodes a
 * security decision (how long a guess budget or a code's mailbox stays
 * capped), not a deployment preference. Only the counts are configurable, for
 * a school large enough that a default pinches.
 *
 * `signin` and `otp` each carry two counts because they are keyed twice — once
 * by the login or destination the caller named, once by their IP — and the
 * two dimensions guard against different attackers. The login/destination
 * count stays at the tight number security asks for (5 signin attempts per 15
 * minutes; 3 new codes per hour, the number that keeps the five-guess OTP
 * budget in `otp.service.ts` from being refilled for free). The IP count is
 * looser on purpose: a school's whole network can sit behind one address, and
 * a cap sized for one attacker would lock out every student behind a shared
 * router the moment a handful of them sign in around the same time.
 *
 * A function, called once at import time below and again by `registerAs`,
 * rather than a precomputed object — like every other factory in this
 * directory, it reads `process.env` on each call rather than baking in
 * whatever it saw first. The per-route guards that key on login or
 * destination (`KeyedThrottlerGuard`) call it directly, at controller class
 * definition time, because they run before Nest's DI container exists to
 * hand them a `ConfigService`.
 */
export const throttlerSettings = () => ({
  default: { limit: int(process.env.VIDYA_THROTTLE_DEFAULT_LIMIT, 100), windowMs: minutes(1) },
  sync: { limit: int(process.env.VIDYA_THROTTLE_SYNC_LIMIT, 300), windowMs: minutes(1) },
  signin: {
    loginLimit: int(process.env.VIDYA_THROTTLE_SIGNIN_LOGIN_LIMIT, 5),
    ipLimit: int(process.env.VIDYA_THROTTLE_SIGNIN_IP_LIMIT, 30),
    windowMs: minutes(15),
  },
  otp: {
    destinationLimit: int(process.env.VIDYA_THROTTLE_OTP_DESTINATION_LIMIT, 3),
    ipLimit: int(process.env.VIDYA_THROTTLE_OTP_IP_LIMIT, 20),
    windowMs: hours(1),
  },
  refresh: { limit: int(process.env.VIDYA_THROTTLE_REFRESH_LIMIT, 20), windowMs: minutes(1) },
})

export default registerAs('throttler', throttlerSettings)
