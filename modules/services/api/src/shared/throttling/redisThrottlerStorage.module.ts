import { Module } from '@nestjs/common'
import { RedisService } from '@vidya/api/shared/services'

import { RedisThrottlerStorage } from './redisThrottlerStorage'

/**
 * Its own Redis connection, same as every module that already keeps one —
 * `AuthModule`, `EduModule` and `SyncModule` each provide their own —
 * pointed at the same `RedisConfig`, not a separately configured client.
 *
 * Imported from both the root module (for the global default guard) and
 * `AuthModule` (for the per-route login/destination guards): a plain module
 * like this one is instantiated once no matter how many places import it, so
 * every guard shares this one connection and its `RedisThrottlerStorage`.
 */
@Module({
  providers: [RedisService, RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class RedisThrottlerStorageModule {}
