import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthUsersService, RevokedTokensService } from '@vidya/api/auth/services'
import { RedisService } from '@vidya/api/shared/services'
import { Enrollment, Role, User, UserRole } from '@vidya/entities'

import { SyncController } from './controllers'
import { CLOCK, ServerHlcService, SyncJournalSubscriber, systemClock } from './journal'
import {
  SyncChecksumsService,
  SyncCursorsService,
  SyncPullService,
  SyncScopesService,
} from './services'

/**
 * The server side of offline sync: the journal, and the endpoints that read it.
 *
 * Nothing in `edu/` changes: the journal is written by a subscriber, and `pull`
 * reads what it wrote.
 *
 * `SyncJournalSubscriber` is eager rather than lazily injected — it registers
 * itself with the `DataSource` in its constructor, so it has to be instantiated
 * at boot or nothing is journalled and nothing complains.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Enrollment, User, Role, UserRole])],
  controllers: [SyncController],
  providers: [
    // What the authentication guard needs to read a token, as `EduModule`
    // provides it too: `AuthModule` exports nothing.
    RedisService,
    AuthUsersService,
    RevokedTokensService,

    { provide: CLOCK, useValue: systemClock },
    ServerHlcService,
    SyncJournalSubscriber,
    SyncScopesService,
    SyncChecksumsService,
    SyncCursorsService,
    SyncPullService,
  ],
  exports: [ServerHlcService],
})
export class SyncModule {}
