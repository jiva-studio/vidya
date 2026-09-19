import { SchoolId, UserId } from '@vidya/domain'
import { SyncOp, SyncScopeKind } from '@vidya/entities'
import { EntityManager } from 'typeorm'

/** One row on its way into `sync_journal`, already addressed and projected. */
export interface JournalRow {
  collection: string
  docId: string
  op: SyncOp
  data: Record<string, unknown> | null
  hlc: string
  scopeKind: SyncScopeKind
  scopeId: string
  schoolId: SchoolId
  deviceId: string | null
  authorId: UserId | null
}

/**
 * Identifies the journal's ordering lock. One constant for the whole journal:
 * the point is that writers queue behind each other, so a finer-grained key
 * would defeat it.
 */
export const JOURNAL_LOCK_KEY = 4_182_019

const INSERT = `
  INSERT INTO sync_journal
    (collection, doc_id, op, data, hlc, scope_kind, scope_id, school_id, device_id, author_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  ON CONFLICT (collection, doc_id, hlc) DO NOTHING
`

/**
 * Appends one row to the journal, inside the caller's transaction.
 *
 * `BIGSERIAL` hands out a number at `INSERT` but the row only becomes visible
 * at `COMMIT`, and the two orders differ. A device that pulls between a
 * lower-numbered transaction's insert and its commit sees only the higher
 * number, advances its cursor past it, and never receives the lower row — a
 * lost homework with no error anywhere. `pg_advisory_xact_lock` is held until
 * commit, so the next writer cannot take a number until the previous one is
 * visible: number order becomes commit order.
 *
 * The lock serialises every journal write for as long as it is held, so it is
 * taken at the last possible moment — a statement or two before commit —
 * rather than at the start of the transaction. Reading only rows below
 * `pg_snapshot_xmin(pg_current_snapshot())` would serialise nothing, but the
 * horizon is held down by any long transaction anywhere in the database, so a
 * two-minute report in the admin console would stop sync for every device.
 *
 * The insert is idempotent by `(collection, doc_id, hlc)`: a retried push finds
 * its row already there and does nothing rather than raising.
 */
export const appendJournalRow = async (manager: EntityManager, row: JournalRow): Promise<void> => {
  await manager.query(`SELECT pg_advisory_xact_lock(${JOURNAL_LOCK_KEY})`)

  await manager.query(INSERT, [
    row.collection,
    row.docId,
    row.op,
    row.data === null ? null : JSON.stringify(row.data),
    row.hlc,
    row.scopeKind,
    row.scopeId,
    row.schoolId,
    row.deviceId,
    row.authorId,
  ])
}
