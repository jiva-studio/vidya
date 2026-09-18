import {
  compareHlcString,
  type ISyncApplyRepository,
  maxHlcString,
  type SyncCollection,
  type SyncDoc,
} from '@vidya/domain'

import type { IDatabase } from '@/ports'

import type { UtcClock } from '../../persistence/migrations'
import { projectionOf, rowToPayload } from './collectionProjections'
import {
  deleteSyncRow,
  isTombstoned,
  readSyncRow,
  sameProjectedColumns,
  writeSyncRow,
} from './rowWriter'

/**
 * SQL adapter that writes what the pull brought in, implementing
 * {@link ISyncApplyRepository}.
 *
 * Logic copied from Lectorium's `infra/repositories/sql/syncApplyRepository.sql.ts`,
 * with two changes that matter:
 *
 * - **`applyRemote` is conditional** (D-4, AC-22a). Lectorium writes
 *   unconditionally. Here the write happens only when the incoming server HLC
 *   is strictly above the pointer already on record, and the method answers
 *   `false` when it skipped. That single test makes the whole pull idempotent
 *   by construction: a page redelivered after a dropped connection, or two
 *   scopes moving at their own pace, can no longer put an older version of a
 *   document on top of a newer one in silence.
 * - **There is no per-collection `switch`.** Lectorium carries three parallel
 *   seven-case switches. Ours reads the projection table
 *   (`collectionProjections.ts`), so adding a collection is a table entry
 *   rather than three edits that can disagree.
 *
 * This adapter exists precisely so that a pulled change does **not** go through
 * the journal decorator: writing it there would put it straight back into the
 * outbox and echo it to the server (AC-16). It never opens a transaction — the
 * page's rows and the scope position that describes them commit together.
 *
 * A tombstone never cascades. Nothing here touches a table other than the one
 * the collection projects onto, so an unpublished lesson version cannot take
 * the homework written against it with it (D-6, AC-22b).
 */

/** Lower than any real stamp — the HLC of a document we have no pointer for. */
export const FLOOR_HLC = '000000000000000:00000:0'

export interface SqlSyncApplyRepositoryDeps {
  readonly db: IDatabase

  /** Whose rows these are. Every statement is filtered by it. */
  readonly ownerId: () => string

  /** Stamps a tombstone's `deleted_at`. UTC, always (D-17, AC-22k). */
  readonly now: UtcClock
}

export function createSqlSyncApplyRepository(
  deps: SqlSyncApplyRepositoryDeps,
): ISyncApplyRepository {
  const { db, ownerId, now } = deps

  /**
   * The document's known local HLC: the greater of any outbox row this device
   * has journaled for it and the last server pointer recorded for it.
   *
   * Both halves are needed. The outbox alone is only what this device has
   * issued; a stamp already pulled in is just as much part of the clock, and
   * skipping it lets a device whose wall clock trails another's stamp an edit
   * *below* the change that edit descends from.
   */
  const knownLocalHlc = async (
    collection: SyncCollection,
    docId: string,
  ): Promise<string | null> => {
    const journaled = await db.query<{ hlc: string | null }>(
      `SELECT MAX(hlc) AS hlc FROM outbox WHERE owner_id = ? AND collection = ? AND doc_id = ?`,
      [ownerId(), collection, docId],
    )
    const pointer = await lastServerHlc(collection, docId)

    return maxHlcString(journaled[0]?.hlc ?? null, pointer)
  }

  const lastServerHlc = async (
    collection: SyncCollection,
    docId: string,
  ): Promise<string | null> => {
    const rows = await db.query<{ server_hlc: string }>(
      'SELECT server_hlc FROM sync_doc_hlc WHERE owner_id = ? AND collection = ? AND doc_id = ?',
      [ownerId(), collection, docId],
    )

    return rows[0]?.server_hlc ?? null
  }

  const recordServerHlc = async (
    collection: SyncCollection,
    docId: string,
    hlc: string,
  ): Promise<void> => {
    await db.execute(
      `INSERT INTO sync_doc_hlc (owner_id, collection, doc_id, server_hlc)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_id, collection, doc_id) DO UPDATE SET server_hlc = excluded.server_hlc`,
      [ownerId(), collection, docId, hlc],
    )
  }

  const readRow = (collection: SyncCollection, docId: string) =>
    readSyncRow(db, { owner: ownerId(), collection, docId })

  return {
    async getLocalDoc(collection, docId): Promise<SyncDoc | null> {
      const localHlc = await knownLocalHlc(collection, docId)
      const row = await readRow(collection, docId)
      if (row === null && localHlc === null) return null

      const projection = projectionOf(collection)
      const deleted = row === null || isTombstoned(projection, row)

      return {
        docId,
        hlc: localHlc ?? FLOOR_HLC,
        deleted,
        data: row === null ? null : rowToPayload(collection, row),
      }
    },

    /**
     * Write a merged document unjournaled, and move its server pointer.
     *
     * The guard is the point: `serverHlc` has to be strictly above what is on
     * record, or nothing is written and the answer is `false`. The caller
     * advances the scope position either way — a row skipped as stale has been
     * *handled*, not lost, and stalling the position on it would replay the
     * page forever.
     */
    async applyRemote(collection, doc, serverHlc): Promise<boolean> {
      const recorded = await lastServerHlc(collection, doc.docId)
      if (recorded !== null && compareHlcString(serverHlc, recorded) <= 0) return false

      const ref = { owner: ownerId(), collection, docId: doc.docId }
      if (doc.deleted || doc.data === null) await deleteSyncRow(db, ref, now)
      else await writeSyncRow(db, ref, doc.data)

      await recordServerHlc(collection, doc.docId, serverHlc)
      return true
    },

    lastServerHlc,
    recordServerHlc,

    /**
     * The highest server pointer on record for this identity, or `null` before
     * the first pull. `MAX` over the text column is the domain order because
     * `hlcToString` zero-pads both numeric components.
     */
    async latestServerHlc(): Promise<string | null> {
      const rows = await db.query<{ hlc: string | null }>(
        'SELECT MAX(server_hlc) AS hlc FROM sync_doc_hlc WHERE owner_id = ?',
        [ownerId()],
      )

      return rows[0]?.hlc ?? null
    },

    /**
     * Whether writing `data` would change anything. A cheap guard for the
     * screens: an identical page redelivered after a reconnect must not repaint
     * a lesson the student is reading (T-R-3).
     */
    async hasSamePayload(collection, docId, data): Promise<boolean> {
      const row = await readRow(collection, docId)
      if (row === null) return data === null
      if (data === null) return isTombstoned(projectionOf(collection), row)

      return sameProjectedColumns(collection, row, data)
    },
  }
}
