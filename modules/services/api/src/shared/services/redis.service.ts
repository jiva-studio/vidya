import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { RedisConfig } from '@vidya/api/configs'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis
  private readonly logger = new Logger(RedisService.name)

  constructor(
    @Inject(RedisConfig.KEY)
    config: ConfigType<typeof RedisConfig>,
  ) {
    this.logger.log('Starting Redis service...')
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    })
  }

  async ping(): Promise<string> {
    return await this.redis.ping()
  }

  async get(key: string): Promise<string | null> {
    return await this.redis.get(key)
  }

  async set(key: string, value: string, seconds: number): Promise<void> {
    await this.redis.set(key, value, 'EX', seconds)
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }

  /**
   * Atomically increments the counter at `key` and returns the new value,
   * creating it at 1 if absent.
   *
   * `INCR` never sets a TTL by itself. Arming one only when the result is 1 —
   * rather than on every call, or via `EXPIRE ... NX` — costs the extra round
   * trip exactly once, on the increment that creates the key, and never resets
   * the TTL that later increments are meant to share.
   */
  async incr(key: string, seconds: number): Promise<number> {
    const value = await this.redis.incr(key)
    if (value === 1) {
      await this.redis.expire(key, seconds)
    }
    return value
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.redis.status === 'ready' || this.redis.status === 'connecting') {
        await this.redis.quit()
      }
    } catch {
      this.redis.disconnect()
    }
  }
}
