import type { SyncCollection, SyncPayload, SyncScopeRef } from '@vidya/domain'

import type { IDatabase, QueryValue, Row } from '../../../ports'
import type { UtcClock } from '../../persistence/migrations'
import {
  type CollectionProjection,
  payloadToRow,
  projectionOf,
  rowToPayload,
  toColumnValue,
} from './collectionProjections'

/**
 * Reading and writing a synced row through its projection.
 *
 * Shared plumbing, not an adapter: the apply repository and the six collection
 * repositories all need "put this payload in that table under this owner", and
 * a second hand-written copy of it is a second place for the column list to
 * fall out of step with migration `001`.
 *
 * Nothing here opens a transaction, and nothing here touches a table other than
 * the one the collection projects onto — which is what keeps a tombstone from
 * cascading.
 */

/** One synced row, addressed the way every synced table is keyed. */
export interface SyncRowRef {
  readonly owner: string
  readonly collection: SyncCollection
  readonly docId: string
}

/** Read one row, or `null` when this identity does not hold it. */
export async function readSyncRow(db: IDatabase, ref: SyncRowRef): Promise<Row | null> {
  const projection = projectionOf(ref.collection)
  const rows = await db.query<Row>(
    `SELECT * FROM ${projection.table} WHERE owner_id = ? AND id = ?`,
    [ref.owner, ref.docId],
  )

  return rows[0] ?? null
}

/**
 * The columns holding the scope a row arrived on. Written from the envelope of
 * the page that brought it and from nowhere else, so a local edit of a pulled
 * row leaves them as the server addressed them.
 */
export const SCOPE_KIND_COLUMN = 'scope_kind'
export const SCOPE_ID_COLUMN = 'scope_id'

/**
 * Upsert a row the pull brought, stamped with the scope that carried it.
 *
 * The scope is the envelope's. It cannot be recomputed from the row: the
 * server addresses a course card to the school and a student's answer to the
 * student, and a device that guessed from `school_id` or `course_id` would
 * take the wrong rows off when a grant is withdrawn.
 */
export const writeScopedRow = (
  db: IDatabase,
  ref: SyncRowRef,
  data: SyncPayload,
  scope: SyncScopeRef,
): Promise<void> =>
  upsertRow(db, ref, data, { [SCOPE_KIND_COLUMN]: scope.kind, [SCOPE_ID_COLUMN]: scope.id })

/**
 * Upsert a row written here.
 *
 * The scope columns are not named, so a local edit of a pulled row keeps the
 * provenance the pull recorded and a row written offline claims none: which
 * grant carries a document is the server's to say, and guessing it here is the
 * one thing the columns exist to avoid.
 */
export const writeSyncRow = (db: IDatabase, ref: SyncRowRef, data: SyncPayload): Promise<void> =>
  upsertRow(db, ref, data, {})

/**
 * One statement for all eight collections, because every synced table has the
 * same primary key — `(owner_id, id)` — and the projection supplies the
 * columns. `owner_id` is prepended here and never comes off the wire: it is the
 * disk layout, not something a server gets to decide.
 */
async function upsertRow(
  db: IDatabase,
  ref: SyncRowRef,
  data: SyncPayload,
  stamped: Record<string, string>,
): Promise<void> {
  const projection = projectionOf(ref.collection)
  const { columns, values } = payloadToRow(ref.collection, { ...data, id: ref.docId })

  const allColumns = ['owner_id', ...columns, ...Object.keys(stamped)]
  const placeholders = allColumns.map(() => '?').join(', ')
  const assignments = [...columns.filter((column) => column !== 'id'), ...Object.keys(stamped)]
    .map((column) => `${column} = excluded.${column}`)
    .join(', ')

  await db.execute(
    `INSERT INTO ${projection.table} (${allColumns.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT(owner_id, id) DO UPDATE SET ${assignments}`,
    [ref.owner, ...values, ...Object.values(stamped)] as QueryValue[],
  )
}

/**
 * Apply a delete.
 *
 * A collection with a tombstone column keeps its row and is marked — an
 * unpublished version is a decision the student has to be able to see
 * explained. A collection without one loses the row. Neither branch reaches
 * another table.
 */
export async function deleteSyncRow(db: IDatabase, ref: SyncRowRef, now: UtcClock): Promise<void> {
  const projection = projectionOf(ref.collection)
  if (projection.tombstone === null) {
    await db.execute(`DELETE FROM ${projection.table} WHERE owner_id = ? AND id = ?`, [
      ref.owner,
      ref.docId,
    ])
    return
  }

  await db.execute(
    `UPDATE ${projection.table} SET ${projection.tombstone} = ? WHERE owner_id = ? AND id = ?`,
    [now(), ref.owner, ref.docId],
  )
}

/** Whether `row` is a tombstone rather than a live row. */
export function isTombstoned(projection: CollectionProjection, row: Row): boolean {
  if (projection.tombstone === null) return false
  const value = row[projection.tombstone]
  return value !== null && value !== undefined
}

/** Whether every projected column of `row` already holds what `data` would write. */
export function sameProjectedColumns(
  collection: SyncCollection,
  row: Row,
  data: SyncPayload,
): boolean {
  return projectionOf(collection).columns.every((column) => {
    const incoming = toColumnValue(column, data[column.field])
    const stored = row[column.column] ?? null
    return incoming === null ? stored === null : String(stored) === String(incoming)
  })
}

/** Read every live row of a collection matching `where`, newest projection first. */
export async function readSyncRows(
  db: IDatabase,
  owner: string,
  collection: SyncCollection,
  where: string,
  params: QueryValue[],
  order?: string,
): Promise<SyncPayload[]> {
  const projection = projectionOf(collection)
  const liveOnly = projection.tombstone === null ? '' : ` AND ${projection.tombstone} IS NULL`
  const rows = await db.query<Row>(
    `SELECT * FROM ${projection.table}
      WHERE owner_id = ?${where === '' ? '' : ` AND ${where}`}${liveOnly}
      ${order === undefined ? '' : `ORDER BY ${order}`}`,
    [owner, ...params],
  )

  return rows.map((row) => rowToPayload(collection, row))
}
