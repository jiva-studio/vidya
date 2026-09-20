import { CanActivate, ExecutionContext, Injectable, mixin, Type } from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'
import { Request } from 'express'

import { RedisThrottlerStorage } from './redisThrottlerStorage'

export type ThrottleKey = {
  /** Distinguishes this key's bucket from every other rule sharing the storage's Redis. */
  name: string
  limit: number
  windowMs: number
  /** Reads the value to key on straight off the raw request — guards run before the DTO pipe. */
  value: (req: Request) => string | undefined
}

/**
 * One or more independent limits, ANDed: a request is refused the moment any
 * one of them is exhausted, and each key keeps its own counter.
 *
 * This is what closes the two ways a single-key limit gets gamed. A limit
 * keyed only by IP is defeated by spreading the same attack across many
 * addresses; a limit keyed only by a caller-supplied value (a login, a
 * destination) is defeated by varying that value, or lets one caller lock out
 * a victim by spamming requests under the victim's own name. Two independent
 * keys close both: a botnet still shares the one login's budget, and a
 * caller rotating IPs still shares its own.
 *
 * A guard, not a named `@nestjs/throttler` policy: the built-in multi-name
 * mechanism runs every registered policy on every route unless each one is
 * explicitly skipped per route, which is more ceremony than two routes need.
 * This is instantiated once per call site via `@UseGuards`, reads whatever
 * `value()` extracts, and throws the same bare `ThrottlerException` — no
 * detail on which key tripped or whether the login/destination it read even
 * exists — regardless of which of the keys was the one that ran out.
 */
export const KeyedThrottlerGuard = (keys: ThrottleKey[]): Type<CanActivate> => {
  @Injectable()
  class MixinKeyedThrottlerGuard implements CanActivate {
    constructor(private readonly storage: RedisThrottlerStorage) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const req = context.switchToHttp().getRequest<Request>()

      const results = await Promise.all(
        keys.map((key) =>
          this.storage.increment(
            key.value(req) || 'unknown',
            key.windowMs,
            key.limit,
            key.windowMs,
            key.name,
          ),
        ),
      )

      if (results.some((result) => result.isBlocked)) {
        throw new ThrottlerException()
      }
      return true
    }
  }

  return mixin(MixinKeyedThrottlerGuard)
}
