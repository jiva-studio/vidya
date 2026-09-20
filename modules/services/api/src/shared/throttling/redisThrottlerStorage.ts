import { Injectable } from '@nestjs/common'
import { ThrottlerStorage } from '@nestjs/throttler'
import { RedisService } from '@vidya/api/shared/services'

// `@nestjs/throttler` computes this shape internally but does not export its
// type from the package's public entry point; declared here, structurally,
// for `implements ThrottlerStorage` to check against.
type ThrottlerStorageRecord = {
  totalHits: number
  timeToExpire: number
  isBlocked: boolean
  timeToBlockExpire: number
}

/**
 * Backs `@nestjs/throttler` with the same Redis the rest of the API already
 * talks to, through `RedisService`, rather than the package's in-memory
 * default. The API is meant to run as more than one process; a per-process
 * counter would give every replica its own budget, multiplying every limit
 * by the replica count.
 *
 * A fixed window: `RedisService.incr` creates the key at 1 and arms its TTL
 * only on that first call (see its own docstring), so every process sees the
 * same count for the same window regardless of which one answered the
 * request.
 *
 * `timeToExpire` and `timeToBlockExpire` are approximated as the window
 * length rather than read back from Redis. Both only feed the
 * `X-RateLimit-*`/`Retry-After` headers the guards in this module turn off —
 * a throttled caller learns nothing about which limit it hit — so a second
 * round trip to price them exactly would buy nothing.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const windowSeconds = Math.max(1, Math.ceil(ttl / 1000))
    const totalHits = await this.redis.incr(`throttle:${throttlerName}:${key}`, windowSeconds)

    return {
      totalHits,
      timeToExpire: windowSeconds,
      isBlocked: totalHits > limit,
      timeToBlockExpire: Math.max(1, Math.ceil(blockDuration / 1000)),
    }
  }
}
