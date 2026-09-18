import { Module } from '@nestjs/common'

import { CLOCK, ServerHlcService, SyncJournalSubscriber, systemClock } from './journal'

/**
 * The server side of offline sync.
 *
 * At this point it is the journal and nothing else: the subscriber that writes
 * it, the server's clock, and the projection table that says what syncs. The
 * `/sync/*` endpoints come next and read what this module writes.
 *
 * `SyncJournalSubscriber` is eager rather than lazily injected — it registers
 * itself with the `DataSource` in its constructor, so it has to be instantiated
 * at boot or nothing is journalled and nothing complains.
 */
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }, ServerHlcService, SyncJournalSubscriber],
  exports: [ServerHlcService],
})
export class SyncModule {}
