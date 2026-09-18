import type {
  IsoDateTime,
  ISyncStateRepository,
  SyncScopeKind,
  SyncScopeRef,
  SyncScopeState,
} from '@vidya/domain'

import type { IDatabase } from '@/ports'

/**
 * SQL adapter over `sync_state` and `sync_scopes`, implementing
 * {@link ISyncStateRepository}.
 *
 * Logic copied from Lectorium's `infra/repositories/sql/syncStateRepository.sql.ts`.
 * The one structural departure is the one the whole stage turns on: Lectorium
 * keeps a single `pull_cursor` column, and we keep a row per scope (I-3).
 * Positions then move independently, which is what makes a newly enrolled
 * course simply "a scope standing at 0" and removes the need for a backfill
 * path — and, in the same stroke, makes it legal for a child row to arrive
 * before its parent (D-13).
 *
 * Both tables are keyed by identity as well as by device, so signing out erases
 * nothing and signing back in works offline. The device id is resolved once and
 * memoized: it is the HLC tiebreak and the echo-suppression key, and all three
 * uses have to agree on one value.
 *
 * Writes go through `db.execute` and join the caller's transaction — the page
 * and the position it advances commit together (D-18, AC-22l).
 */

interface ScopeRow {
  kind: string
  id: string
  cursor: number
  checksum: string | null
  removed_at: string | null
}

export interface SqlSyncStateRepositoryDeps {
  readonly db: IDatabase

  /** Stable per-installation id. Resolved once, then memoized. */
  readonly deviceId: () => Promise<string>

  /** Whose state this is. Read per call: the identity changes under a live bundle. */
  readonly ownerId: () => string
}

export function createSqlSyncStateRepository(
  deps: SqlSyncStateRepositoryDeps,
): ISyncStateRepository {
  const { db, ownerId } = deps

  let cachedDeviceId: string | null = null
  const deviceId = async (): Promise<string> => {
    if (cachedDeviceId === null) cachedDeviceId = await deps.deviceId()
    return cachedDeviceId
  }

  /**
   * Make sure this `(device, owner)` pair has a row, then set one column.
   *
   * Two statements rather than one UPSERT: an UPSERT would have to name the
   * column in both `VALUES` and the conflict clause, and the column is a
   * parameter here, so the restatement is exactly where a typo would hide.
   */
  const writeCounter = async (column: 'acked_seq' | 'pushed_outbox_id', value: number) => {
    const device = await deviceId()
    await db.execute(
      `INSERT OR IGNORE INTO sync_state (device_id, owner_id, acked_seq, pushed_outbox_id)
       VALUES (?, ?, 0, 0)`,
      [device, ownerId()],
    )
    await db.execute(`UPDATE sync_state SET ${column} = ? WHERE device_id = ? AND owner_id = ?`, [
      value,
      device,
      ownerId(),
    ])
  }

  const readCounter = async (column: 'acked_seq' | 'pushed_outbox_id'): Promise<number> => {
    const device = await deviceId()
    const rows = await db.query<{ value: number | null }>(
      `SELECT ${column} AS value FROM sync_state WHERE device_id = ? AND owner_id = ?`,
      [device, ownerId()],
    )

    const value = rows[0]?.value
    return value === null || value === undefined ? 0 : Number(value)
  }

  return {
    getDeviceId: deviceId,

    /**
     * Every scope this identity knows, removed ones included — a withdrawn
     * course still has to be listed so its data stays explicable (D-7).
     */
    listScopes: async (): Promise<readonly SyncScopeState[]> => {
      const rows = await db.query<ScopeRow>(
        'SELECT kind, id, cursor, checksum, removed_at FROM sync_scopes WHERE owner_id = ? ORDER BY kind, id',
        [ownerId()],
      )

      return rows.map(toScopeState)
    },

    /**
     * Move one scope's position and record the checksum that came with it.
     *
     * Called inside the transaction that wrote the page. Positions are
     * independent by construction here: the statement names one `(kind, id)`
     * and can no more touch a sibling scope than it can touch another table.
     */
    setScopeCursor: async (scope, cursor, checksum) => {
      await db.execute(
        `INSERT INTO sync_scopes (owner_id, kind, id, cursor, checksum)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(owner_id, kind, id)
         DO UPDATE SET cursor = excluded.cursor, checksum = excluded.checksum`,
        [ownerId(), scope.kind, scope.id, cursor, checksum],
      )
    },

    /**
     * Start tracking a scope at position `0`.
     *
     * `INSERT OR IGNORE`, so re-reporting a scope the device already follows
     * cannot rewind it: the server sends the full grant list on every pull, and
     * a plain insert would put an established course back to the beginning on
     * the next page.
     */
    addScope: async (scope) => {
      await db.execute(
        `INSERT OR IGNORE INTO sync_scopes (owner_id, kind, id, cursor, checksum, removed_at)
         VALUES (?, ?, ?, 0, NULL, NULL)`,
        [ownerId(), scope.kind, scope.id],
      )
    },

    /**
     * Mark a scope gone, keeping every row it brought (D-7, AC-22c).
     *
     * This is the whole of "the student was withdrawn from a course" on the
     * device. Nothing is deleted: reading what was downloaded is unconditional,
     * and the enrolment row arrives with its own status to explain the screen.
     */
    markScopeRemoved: async (scope: SyncScopeRef, at: IsoDateTime) => {
      await db.execute(
        'UPDATE sync_scopes SET removed_at = ? WHERE owner_id = ? AND kind = ? AND id = ?',
        [at, ownerId(), scope.kind, scope.id],
      )
    },

    /**
     * Take the removal mark off a scope granted again (D-4, AC-22c).
     *
     * The position and the checksum are left exactly where they stand: the rows
     * this scope brought were never deleted, so the device does not need them
     * again — it needs what happened while it was away, which is precisely what
     * the kept position asks for.
     */
    restoreScope: async (scope: SyncScopeRef) => {
      await db.execute(
        'UPDATE sync_scopes SET removed_at = NULL WHERE owner_id = ? AND kind = ? AND id = ?',
        [ownerId(), scope.kind, scope.id],
      )
    },

    /**
     * Put one scope back to `0` so its history is fetched again — the answer to
     * a checksum that does not match (I-5, AC-10m).
     *
     * The checksum is cleared with it, because the stored one describes content
     * we have just declared untrustworthy. One scope, never the database: a
     * diverged course must not cost the student every other course's content.
     */
    resetScope: async (scope) => {
      await db.execute(
        'UPDATE sync_scopes SET cursor = 0, checksum = NULL WHERE owner_id = ? AND kind = ? AND id = ?',
        [ownerId(), scope.kind, scope.id],
      )
    },

    getAckedSeq: () => readCounter('acked_seq'),
    setAckedSeq: (seq) => writeCounter('acked_seq', seq),

    getPushedOutboxId: () => readCounter('pushed_outbox_id'),
    setPushedOutboxId: (id) => writeCounter('pushed_outbox_id', id),
  }
}

function toScopeState(row: ScopeRow): SyncScopeState {
  return {
    scope: { kind: row.kind as SyncScopeKind, id: row.id },
    cursor: Number(row.cursor),
    checksum: row.checksum,
    removedAt: row.removed_at === null ? null : (row.removed_at as IsoDateTime),
  }
}
