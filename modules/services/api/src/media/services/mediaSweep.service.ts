<<<<<<< HEAD
import { Injectable, Logger } from '@nestjs/common'
||||||| 2f94496
import { Injectable } from '@nestjs/common'
=======
import { Inject, Injectable, Logger } from '@nestjs/common'
>>>>>>> origin/feat/media-upload
import { InjectDataSource } from '@nestjs/typeorm'
<<<<<<< HEAD
||||||| 2f94496
import { StorageProfile } from '@vidya/entities'
=======
import { DefaultAbandonedAfterMs, MediaConfig } from '@vidya/api/configs'
>>>>>>> origin/feat/media-upload
import { Media, StorageProfile } from '@vidya/entities'
import { DataSource, QueryRunner } from 'typeorm'

import { prefixOf } from './mediaLimits'
import { MediaRowsService } from './mediaRows.service'
import { SchoolStorageService } from './schoolStorage.service'

/**
 * Identifies the sweep lock. Any constant does, as long as every deployment of
 * this service uses the same one and nothing else in the schema uses it.
 */
const SWEEP_LOCK_ID = 4_182_004

/** The part of the installation's media configuration the sweep reads. */
type SweepWindow = { abandonedAfterMs: number }

/**
 * Clearing up after uploads that were never finished.
 *
 * It is the only mechanism there is: a lifecycle rule on the bucket cannot be
 * the second line of defence: Bunny has no lifecycle rules at all,
 * `AbortIncompleteMultipartUpload` included. So both halves are done here —
 * the pending rows with their objects, and the multipart sessions that a
 * listing cannot see and the provider still charges for.
 *
 * More than one instance of the API runs, so the work is taken under a session
 * advisory lock on a dedicated connection: whoever gets it sweeps, and everyone
 * else leaves without an error rather than deleting the same objects twice.
 *
<<<<<<< HEAD
 * A row a deletion archived and never finished is swept the same way. It is the
 * one state nobody else repairs: the bytes are no longer charged for, so nothing
 * but this notices that the object is still being paid for.
||||||| 2f94496
=======
 * One object that will not go must not cost the rest their tick: a failure is
 * named and the row kept, so an operator can find it and the next tick reaches
 * everything behind it.
>>>>>>> origin/feat/media-upload
 */
@Injectable()
export class MediaSweepService {
<<<<<<< HEAD
  private readonly log = new Logger(MediaSweepService.name)
||||||| 2f94496
=======
  private readonly logger = new Logger(MediaSweepService.name)
>>>>>>> origin/feat/media-upload

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly rows: MediaRowsService,
    private readonly storages: SchoolStorageService,
    @Inject(MediaConfig.KEY)
    private readonly config: SweepWindow = { abandonedAfterMs: DefaultAbandonedAfterMs },
  ) {}

  async sweepAbandonedUploads(): Promise<void> {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()

    let taken = false
    try {
      taken = await this.takeLock(runner)
      if (!taken) return

      const before = new Date(Date.now() - this.config.abandonedAfterMs)
      await this.dropAbandonedRows(before)
      await this.abortStaleSessions(before)
    } finally {
      await this.letGo(runner, taken)
    }
  }

  /**
   * Gives the lock back, unless the connection it was taken on has already
   * gone.
   *
   * The in-memory database the suites run on has a single session and hands it
   * to every caller, so a repository call inside the sweep releases the very
   * runner the lock was taken on. Unlocking it then throws from a `finally` and
   * hides whatever the sweep itself was failing on.
   */
  private async letGo(runner: QueryRunner, taken: boolean): Promise<void> {
    if (runner.isReleased) return

    if (taken) await runner.query('SELECT pg_advisory_unlock($1)', [SWEEP_LOCK_ID])
    await runner.release()
  }

  private async takeLock(runner: QueryRunner): Promise<boolean> {
    const rows = await runner.query('SELECT pg_try_advisory_lock($1) AS taken', [SWEEP_LOCK_ID])

    return Boolean(rows[0]?.taken)
  }

  private async dropAbandonedRows(before: Date): Promise<void> {
    for (const media of await this.rows.findAbandoned(before)) {
      await this.clearRow(media)
    }
  }

  /**
   * One row's object and then its row, with whatever went wrong named rather
   * than raised: the rows are swept oldest first, so a row the sweep cannot
   * clear would otherwise be met again on every tick and take the rest of the
   * work — the other rows and the multipart sessions — down with it.
   */
  private async clearRow(media: Media): Promise<void> {
    try {
      const opened = await this.storages.openProfileById(media.profileId)

      await opened.storage.remove(media.storageKey)
      await this.rows.deleteRow(media.id)
    } catch (err) {
      this.log.error(`Media ${media.id} could not be cleared: ${(err as Error).message}`)
    }
  }

  private async abortStaleSessions(before: Date): Promise<void> {
    for (const profile of await this.rows.findLiveProfiles()) {
      await this.abortSessionsIn(profile, before)
    }
  }

  private async abortSessionsIn(profile: StorageProfile, before: Date): Promise<void> {
    const opened = this.storages.openProfile(profile)

    for await (const session of opened.storage.listUnfinished(prefixOf(profile))) {
      if (session.startedAt < before) {
        await opened.storage.abortUnfinished(session.key, session.uploadId)
      }
    }
  }
}
