import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthUsersService, RevokedTokensService } from '@vidya/api/auth/services'
import { SchoolMembershipModule } from '@vidya/api/schoolMembership.module'
import { RedisService } from '@vidya/api/shared/services'
import { Enrollment, Role, User, UserRole } from '@vidya/entities'

import { SyncController } from './controllers'
import { CLOCK, ServerHlcService, SyncJournalSubscriber, systemClock } from './journal'
import {
  SyncChecksumsService,
  SyncCursorsService,
  SyncPullService,
  SyncPushRowService,
  SyncPushService,
  SyncScopesService,
  SyncStampingService,
} from './services'

/**
 * The server side of offline sync: the journal, and the three endpoints that
 * read and write it.
 *
 * Nothing in `edu/` changes. The journal is written by a subscriber and read by
 * `pull`; a `push` applies rows through the ORM and lets that same subscriber
 * record them, so there is exactly one place a synchronised change is written
 * down and exactly one place the rules of a collection live.
 *
 * `SyncJournalSubscriber` is eager rather than lazily injected — it registers
 * itself with the `DataSource` in its constructor, so it has to be instantiated
 * at boot or nothing is journalled and nothing complains.
 */
@Module({
  imports: [
    // Answers `SCHOOL_MEMBERSHIP`, the one thing a scope grant needs and this
    // context cannot work out on its own.
    SchoolMembershipModule,
    TypeOrmModule.forFeature([Enrollment, User, Role, UserRole]),
  ],
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
    SyncStampingService,
    SyncPushRowService,
    SyncPushService,
  ],
  exports: [ServerHlcService],
})
export class SyncModule {}
