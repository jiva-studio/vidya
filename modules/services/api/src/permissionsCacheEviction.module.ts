import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthUsersService } from '@vidya/api/auth/services'
import { PERMISSIONS_CACHE_EVICTION, PermissionsCacheEviction } from '@vidya/api/edu/ports'
import { RedisService } from '@vidya/api/shared/services'
import { Role, User } from '@vidya/entities'

/**
 * Binds the one instruction `edu` gives `auth` — forget this user's cached
 * permissions — to the service that owns the cache.
 *
 * `AuthModule` exports nothing (`SyncModule`'s own import site says why: every
 * consumer of `AuthUsersService` brings its own instance rather than pulling
 * in the mailer, JWT, and controller wiring that come with `AuthModule`), so
 * this does the same rather than importing it. `TypeOrmModule.forFeature` is
 * repeated here for the same reason `SyncModule` repeats it — `AuthUsersService`
 * needs `User` and `Role` repositories of its own in this module's injector.
 *
 * Composition, and nothing else: `edu` knows the port it declared in
 * `edu/ports`, `auth` knows nothing of `edu`, and the fact that eviction is a
 * Redis `DEL` today is a fact this file alone holds.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Role])],
  providers: [
    RedisService,
    AuthUsersService,
    {
      provide: PERMISSIONS_CACHE_EVICTION,
      useFactory: (authUsers: AuthUsersService): PermissionsCacheEviction => ({
        evict: (userIds) => authUsers.evictUserPermissions(userIds),
      }),
      inject: [AuthUsersService],
    },
  ],
  exports: [PERMISSIONS_CACHE_EVICTION],
})
export class PermissionsCacheEvictionModule {}
