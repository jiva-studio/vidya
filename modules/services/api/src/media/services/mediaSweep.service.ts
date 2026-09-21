import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { StorageProfile } from '@vidya/entities'
import { DataSource, QueryRunner } from 'typeorm'

import { MediaRowsService } from './mediaRows.service'
import { SchoolStorageService } from './schoolStorage.service'

/**
 * Identifies the sweep lock. Any constant does, as long as every deployment of
 * this service uses the same one and nothing else in the schema uses it.
 */
const SWEEP_LOCK_ID = 4_182_004

/**
 * How long an upload is given before it is presumed abandoned.
 *
 * A day rather than an hour because an upload is a person on a hotel wifi with
 * a two-gigabyte lecture, and a sweep that collects a running upload deletes
 * the object out from under it.
 */
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000

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
 */
@Injectable()
export class MediaSweepService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly rows: MediaRowsService,
    private readonly storages: SchoolStorageService,
  ) {}

  async sweepAbandonedUploads(): Promise<void> {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()

    let taken = false
    try {
      taken = await this.takeLock(runner)
      if (!taken) return

      const before = new Date(Date.now() - ABANDONED_AFTER_MS)
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
      const opened = await this.storages.openProfileById(media.profileId)

      await opened.storage.remove(media.storageKey)
      await this.rows.deleteRow(media.id)
    }
  }

  private async abortStaleSessions(before: Date): Promise<void> {
    for (const profile of await this.rows.findLiveProfiles()) {
      await this.abortSessionsIn(profile, before)
    }
  }

  private async abortSessionsIn(profile: StorageProfile, before: Date): Promise<void> {
    const opened = this.storages.openProfile(profile)

    for await (const session of opened.storage.listUnfinished(profile.prefix)) {
      if (session.startedAt < before) {
        await opened.storage.abortUnfinished(session.key, session.uploadId)
      }
    }
  }
}
