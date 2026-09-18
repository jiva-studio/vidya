import type { SyncCollection, SyncPayload } from '@vidya/domain'

import type { IDatabase, QueryValue, Row } from '@/ports'

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
 * cascading (D-6, AC-22b).
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
 * Upsert the projected row.
 *
 * One statement for all six collections, because every synced table has the
 * same primary key — `(owner_id, id)` — and the projection supplies the
 * columns. `owner_id` is prepended here and never comes off the wire: it is the
 * disk layout, not something a server gets to decide.
 */
export async function writeSyncRow(
  db: IDatabase,
  ref: SyncRowRef,
  data: SyncPayload,
): Promise<void> {
  const projection = projectionOf(ref.collection)
  const { columns, values } = payloadToRow(ref.collection, { ...data, id: ref.docId })

  const allColumns = ['owner_id', ...columns]
  const placeholders = allColumns.map(() => '?').join(', ')
  const assignments = columns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = excluded.${column}`)
    .join(', ')

  await db.execute(
    `INSERT INTO ${projection.table} (${allColumns.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT(owner_id, id) DO UPDATE SET ${assignments}`,
    [ref.owner, ...values] as QueryValue[],
  )
}

/**
 * Apply a delete.
 *
 * A collection with a tombstone column keeps its row and is marked — a
 * withdrawn enrolment and an unpublished version are decisions the student has
 * to be able to see explained (D-6, D-7). A collection without one loses the
 * row. Neither branch reaches another table.
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
