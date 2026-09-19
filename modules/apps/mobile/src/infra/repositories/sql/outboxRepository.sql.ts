import type {
  IOutboxRepository,
  NewOutboxEntry,
  OutboxAcknowledgement,
  OutboxDocRename,
  OutboxEntry,
  OutboxScope,
  OutboxStatus,
  SyncCollection,
  SyncOp,
  SyncPayload,
  SyncRejectionReason,
} from '@vidya/domain'
import { rejectionKeepsLocalWork } from '@vidya/domain'

import type { IDatabase, QueryValue } from '@/ports'

import type { UtcClock } from '../../persistence/migrations'

/**
 * SQL adapter over the local `outbox` journal, implementing
 * {@link IOutboxRepository}.
 *
 * Three properties are deliberate:
 *
 * - **An outbox row is never deleted**, on any path. A refusal is a state the
 *   row keeps, so the reason stays next to the student's work and the work
 *   stays on the phone. The journal therefore grows without bound — by the
 *   student's own edits, which is tens of rows a week, and that price was
 *   accepted openly.
 * - **Rows are never re-attributed.** Sign-in is by OTP only, so there is no
 *   anonymous account whose changes would have to be adopted.
 * - **`status` is three-valued** — `pending | pushed | rejected` — so a refused
 *   row is distinguishable from one that was never sent.
 *
 * Every write goes through `db.execute` rather than `mutate`: the caller owns
 * the transaction, and a `save()` in the middle of one would flush a half-built
 * unit of work. This adapter never opens a transaction of its own.
 */

interface OutboxRow {
  id: number
  collection: string
  doc_id: string
  op: string
  data: string | null
  hlc: string
  base_hlc: string | null
  owner_id: string
  status: string
  reason: string | null
  created_at: string
}

export interface SqlOutboxRepositoryDeps {
  readonly db: IDatabase

  /** Stamps `created_at`. UTC, always. */
  readonly now: UtcClock
}

export function createSqlOutboxRepository(deps: SqlOutboxRepositoryDeps): IOutboxRepository {
  const { db, now } = deps

  return {
    listPending: (scope, limit) => listPending(db, scope, limit),
    listUnsettled: (scope) => listUnsettled(db, scope),
    append: (entry) => append(db, now, entry),
    acknowledge: (results) => acknowledge(db, results),
    renameDoc: (rename) => renameDoc(db, rename),
    latestHlc: (ownerId) => latestHlc(db, ownerId),
    latestHlcOnDevice: () => latestHlcOnDevice(db),
    latestId: (ownerId) => latestId(db, ownerId),
  }
}

/**
 * Pending rows of one owner, oldest first, above the watermark.
 *
 * Both guards are load-bearing and neither is redundant. `status = 'pending'`
 * keeps an answered row out; `id > afterId` keeps a *refused* row out even
 * though a future build might reopen it, because the watermark is what stops
 * the device pushing a rejected answer forever. Insertion order is the
 * contract: two offline edits of one document have to reach the server in the
 * order they were made, or the earlier text wins.
 */
async function listPending(
  db: IDatabase,
  scope: OutboxScope,
  limit?: number,
): Promise<readonly OutboxEntry[]> {
  const sql = `SELECT * FROM outbox
                WHERE owner_id = ? AND status = 'pending' AND id > ?
                ORDER BY id ASC`
  const params: QueryValue[] = [scope.ownerId, scope.afterId ?? 0]
  const rows =
    limit === undefined
      ? await db.query<OutboxRow>(sql, params)
      : await db.query<OutboxRow>(`${sql} LIMIT ?`, [...params, limit])

  return rows.map(toEntry)
}

/**
 * Rows of one owner whose work is still only on this device.
 *
 * `pending`, plus the refused rows whose reason leaves the text the student's.
 * Which reasons those are is the domain's answer, not this adapter's, so the
 * filter is applied over the rows rather than written into the SQL: a reason
 * added to the contract later must not need a second decision spelt out here.
 */
async function listUnsettled(db: IDatabase, scope: OutboxScope): Promise<readonly OutboxEntry[]> {
  const rows = await db.query<OutboxRow>(
    `SELECT * FROM outbox
      WHERE owner_id = ? AND status IN ('pending', 'rejected')
      ORDER BY id ASC`,
    [scope.ownerId],
  )

  return rows
    .map(toEntry)
    .filter((entry) => entry.reason === null || rejectionKeepsLocalWork(entry.reason))
}

/**
 * Append one journaled change.
 *
 * Called by the journal decorator inside the transaction that also writes the
 * domain row, so the change and the record of the change are atomic.
 * The HLC is stamped by the caller: only it knows the clock and the last stamp
 * this device has issued or observed.
 */
async function append(db: IDatabase, now: UtcClock, entry: NewOutboxEntry): Promise<void> {
  await db.execute(
    `INSERT INTO outbox (collection, doc_id, op, data, hlc, base_hlc, owner_id, status, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?)`,
    [
      entry.collection,
      entry.docId,
      entry.op,
      entry.data === null ? null : JSON.stringify(entry.data),
      entry.hlc,
      entry.baseHlc,
      entry.ownerId,
      now(),
    ],
  )
}

/**
 * Record the server's per-row answer.
 *
 * Idempotent, because a push replayed after a dropped connection replays its
 * answers too. It never deletes: an accepted row becomes `pushed`, a
 * refused one becomes `rejected` and keeps the reason for as long as it lives.
 */
async function acknowledge(
  db: IDatabase,
  results: readonly OutboxAcknowledgement[],
): Promise<void> {
  for (const result of results) {
    await db.execute('UPDATE outbox SET status = ?, reason = ? WHERE id = ?', [
      result.status,
      result.reason ?? null,
      result.id,
    ])
  }
}

/**
 * Point every journaled row of one document at the id the server wrote under.
 *
 * Both the row just answered and the edits still waiting behind it: an edit
 * left under the local name would be sent under a name the server has to
 * translate again, and the answer to that would rename a document that no
 * longer exists. The payload carries the id too, so it moves with the row.
 */
async function renameDoc(db: IDatabase, rename: OutboxDocRename): Promise<void> {
  const rows = await db.query<OutboxRow>(
    'SELECT id, data FROM outbox WHERE owner_id = ? AND collection = ? AND doc_id = ?',
    [rename.ownerId, rename.collection, rename.docId],
  )

  for (const row of rows) {
    const data =
      row.data === null
        ? null
        : JSON.stringify({ ...(JSON.parse(row.data) as SyncPayload), id: rename.serverDocId })

    await db.execute('UPDATE outbox SET doc_id = ?, data = ? WHERE id = ?', [
      rename.serverDocId,
      data,
      row.id,
    ])
  }
}

/**
 * The highest HLC this owner ever journaled.
 *
 * `MAX` over the text column rather than the tail row: `hlcToString` zero-pads
 * both numeric components precisely so SQLite's lexicographic order is the
 * order `compareHlc` defines, and a max is honest even if a row were ever
 * inserted out of order.
 */
async function latestHlc(db: IDatabase, ownerId: string): Promise<string | null> {
  const rows = await db.query<{ hlc: string | null }>(
    'SELECT MAX(hlc) AS hlc FROM outbox WHERE owner_id = ?',
    [ownerId],
  )

  return rows[0]?.hlc ?? null
}

/**
 * The highest HLC on this installation, whoever journaled it.
 *
 * No `owner_id` in the statement, and that absence is the point: the stamp's
 * counter belongs to the device id every row here shares, so the seat it is
 * read from has to be the device's too. Filtering by identity hands the next
 * student a counter that starts again from a millisecond already spent.
 */
async function latestHlcOnDevice(db: IDatabase): Promise<string | null> {
  const rows = await db.query<{ hlc: string | null }>('SELECT MAX(hlc) AS hlc FROM outbox')

  return rows[0]?.hlc ?? null
}

/** The highest row id this owner ever journaled, `0` on an empty journal. */
async function latestId(db: IDatabase, ownerId: string): Promise<number> {
  const rows = await db.query<{ id: number | null }>(
    'SELECT MAX(id) AS id FROM outbox WHERE owner_id = ?',
    [ownerId],
  )

  const id = rows[0]?.id
  return id === null || id === undefined ? 0 : Number(id)
}

function toEntry(row: OutboxRow): OutboxEntry {
  return {
    id: Number(row.id),
    collection: row.collection as SyncCollection,
    docId: row.doc_id,
    op: row.op as SyncOp,
    data: row.data === null ? null : (JSON.parse(row.data) as SyncPayload),
    hlc: row.hlc,
    baseHlc: row.base_hlc,
    ownerId: row.owner_id,
    status: row.status as OutboxStatus,
    reason: row.reason === null ? null : (row.reason as SyncRejectionReason),
    createdAt: row.created_at as OutboxEntry['createdAt'],
  }
}
