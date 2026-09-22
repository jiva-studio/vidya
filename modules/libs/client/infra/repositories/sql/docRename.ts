import type { SyncCollection, SyncPayload } from '@vidya/domain'

import type { IDatabase, QueryValue } from '../../../ports'
import { projectionOf, toColumnValue } from './collectionProjections'
import { readSyncRow, type SyncRowRef } from './rowWriter'

/**
 * Reconciling a local name for a document with the server's name for it.
 *
 * Shared plumbing rather than an adapter, for the same reason `rowWriter.ts`
 * is: the statement list is per-collection knowledge, and a second hand-written
 * copy of it is a second place for it to fall out of step with migration `001`.
 */

/**
 * The columns the local unique indexes of migration `001` are built on.
 *
 * Only these, and not every key the server holds: this table drives the one
 * thing that cannot wait, which is a write the index would refuse. An
 * enrolment named twice is not refused by anything here, so its two names are
 * reconciled when the push answers, where nothing has to be guessed.
 */
const UNIQUE_KEYS: Partial<Record<SyncCollection, readonly string[]>> = {
  homework: ['enrollment_id', 'lesson_version_id', 'section_id'],
  block_states: ['enrollment_id', 'lesson_version_id', 'block_id'],
}

/** A local column that addresses a document of another collection by its id. */
interface SyncReference {
  readonly table: string
  readonly column: string
}

/**
 * Local rows that name a document of `collection` by id.
 *
 * Only the enrolment is named by anything: homework and block states hang off
 * the place on the course, and a place renamed without them keeps its rows
 * pointing at a name nothing holds.
 */
const REFERENCES: Partial<Record<SyncCollection, readonly SyncReference[]>> = {
  enrollments: [
    { table: 'homework', column: 'enrollment_id' },
    { table: 'block_states', column: 'enrollment_id' },
  ],
}

export interface DocRename {
  readonly owner: string
  readonly collection: SyncCollection
  readonly docId: string
  readonly serverDocId: string
}

/**
 * Give the row, and everything that names it, the server's id.
 *
 * When a row already sits under `serverDocId` the local one is deleted instead
 * of renamed: the two ids are one document, the server's copy is the one that
 * exists, and renaming onto an occupied key would fail. Nothing is merged —
 * the HLC decided the text on the server.
 *
 * Runs in the caller's transaction and is safe to repeat: with no row under
 * `docId` every statement here matches nothing.
 */
export async function renameLocalDoc(db: IDatabase, rename: DocRename): Promise<void> {
  const { owner, collection, docId, serverDocId } = rename
  const { table } = projectionOf(collection)
  const winner = await readSyncRow(db, { owner, collection, docId: serverDocId })

  if (winner === null) {
    await db.execute(`UPDATE ${table} SET id = ? WHERE owner_id = ? AND id = ?`, [
      serverDocId,
      owner,
      docId,
    ])
  } else {
    await db.execute(`DELETE FROM ${table} WHERE owner_id = ? AND id = ?`, [owner, docId])
  }

  for (const reference of REFERENCES[collection] ?? []) {
    await db.execute(
      `UPDATE ${reference.table} SET ${reference.column} = ?
        WHERE owner_id = ? AND ${reference.column} = ?`,
      [serverDocId, owner, docId],
    )
  }
}

/**
 * Remove a local row holding this document's unique key under another id.
 *
 * The incoming row and the local one are the same piece of work under two
 * names, and the local name is one only this device has ever used. Leaving it
 * there fails the unique index and takes the whole page down with it, page
 * after page, so the document that arrives is the one that stays. No text is
 * lost: the unsent edit is still in the journal, and the server merges it by
 * HLC when the push that renames the row is answered.
 */
export async function dropLocalRival(
  db: IDatabase,
  ref: SyncRowRef,
  data: SyncPayload,
): Promise<void> {
  const projection = projectionOf(ref.collection)
  const key = UNIQUE_KEYS[ref.collection]
  if (key === undefined) return

  const values: QueryValue[] = []
  for (const column of key) {
    const projected = projection.columns.find((candidate) => candidate.column === column)
    const value = projected === undefined ? null : toColumnValue(projected, data[projected.field])

    // A row that does not carry its whole key addresses nothing, so there is
    // nothing it can be a second name for.
    if (value === null) return
    values.push(value)
  }

  await db.execute(
    `DELETE FROM ${projection.table}
      WHERE owner_id = ? AND id <> ? AND ${key.map((column) => `${column} = ?`).join(' AND ')}`,
    [ref.owner, ref.docId, ...values],
  )
}
