import type { SyncCollection } from '@vidya/domain'

import type { IDatabase } from '@/ports'

import { projectionOf } from './collectionProjections'
import { readSyncRow } from './rowWriter'

/**
 * Reconciling a local name for a document with the server's name for it.
 *
 * Shared plumbing rather than an adapter, for the same reason `rowWriter.ts`
 * is: the statement list is per-collection knowledge, and a second hand-written
 * copy of it is a second place for it to fall out of step with migration `001`.
 */

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
