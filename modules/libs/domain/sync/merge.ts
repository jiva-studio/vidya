/**
 * How an incoming server version is merged into the local one.
 *
 * The writing sides are split (`direction.ts`), so the question a merge answers
 * is not "who wrote last" but "who owns this field": the server's fields are
 * always taken from the incoming version, and the client's are kept whenever
 * this device still holds an unsent outbox row for the document — otherwise a
 * review status would land on top of an answer that has not been sent yet.
 *
 * Pure and idempotent: merging a version with itself returns an equivalent
 * value, so a page redelivered after a dropped connection changes nothing.
 */

import { clientOwnedFields, ownsEveryField, serverOwnedFields } from './direction'
import { compareHlcString } from './hlc'
import { isSyncCollection, SyncCollection, SyncDoc, SyncPayload } from './types'

/**
 * Merge the incoming `remote` version of a document into the `local` one.
 *
 * @param local                 what this device holds, or `null` when the
 *                              document is new here.
 * @param hasPendingLocalWrite  whether an unsent outbox row exists for this
 *                              document. `false` means the device has nothing
 *                              of its own to protect, so the server's version
 *                              is taken whole.
 *
 * Throws on a collection that does not replicate: a row addressed to an unknown
 * collection is a contract break, and silently dropping it is how one side
 * ships a table the other never hears about.
 */
export function mergeIncoming<T extends SyncPayload>(
  collection: SyncCollection,
  local: SyncDoc<T> | null,
  remote: SyncDoc<T>,
  hasPendingLocalWrite = false,
): SyncDoc<T> {
  if (!isSyncCollection(collection)) {
    throw new Error(`Unknown sync collection: ${collection}`)
  }

  // A tombstone is the server's decision (an enrolment withdrawn, a version
  // unpublished) and is never outvoted here. What it must not do is cascade,
  // and that is the repository's rule, not the merge's.
  if (local === null || remote.deleted) return remote

  if (!hasPendingLocalWrite) return remote

  const clientFields = clientOwnedFields(collection)
  if (clientFields.length === 0) return remote

  // The device owns the whole row, so the server can only be echoing it back.
  if (ownsEveryField(clientFields)) return local

  return mergeOwnedFields(local, remote, clientFields, serverOwnedFields(collection))
}

/**
 * Take the incoming row and put this device's unsent fields back on top of it.
 * A field claimed by both sides stays the server's: on `enrollments.status` the
 * school's answer supersedes the request that asked for it.
 */
function mergeOwnedFields<T extends SyncPayload>(
  local: SyncDoc<T>,
  remote: SyncDoc<T>,
  clientFields: readonly string[],
  serverFields: readonly string[],
): SyncDoc<T> {
  if (local.data === null || remote.data === null) return remote

  const merged: SyncPayload = { ...remote.data }
  for (const field of clientFields) {
    if (serverFields.includes(field)) continue
    if (field in local.data) merged[field] = local.data[field]
    else delete merged[field]
  }

  return {
    docId: remote.docId,
    hlc: compareHlcString(local.hlc, remote.hlc) >= 0 ? local.hlc : remote.hlc,
    deleted: false,
    data: merged as T,
  }
}
