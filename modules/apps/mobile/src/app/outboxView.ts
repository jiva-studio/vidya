import type {
  IOutboxRepository,
  OutboxEntry,
  SyncCollection,
  SyncRejectionReason,
} from '@vidya/domain'
import { createGlobalState } from '@vueuse/core'
import { ref, watch } from 'vue'

import { type SubmissionState, submissionStateOf } from '@/ui/sync/model/submissionState'

import { useSyncStatus } from './syncStatus'

/**
 * How far each journaled row has travelled, as a screen asks about it.
 *
 * A screen holds a document, not an outbox row, so the question is always
 * "what happened to this document" — and the answer has to be there when the
 * row is rendered rather than a promise. The journal is therefore read into a
 * snapshot and re-read when a run finishes.
 *
 * Only unsettled rows are held: a row the server has taken is gone from the
 * list, and a document with no row is accepted.
 */
export interface OutboxView {
  state(collection: SyncCollection, docId: string): SubmissionState
  reason(collection: SyncCollection, docId: string): SyncRejectionReason | undefined

  /** Reads this identity's journal, and keeps reading it after every run. */
  track(ownerId: string, outbox: IOutboxRepository): void
}

const keyOf = (collection: SyncCollection, docId: string) => `${collection}:${docId}`

export const useOutboxView = createGlobalState((): OutboxView => {
  const status = useSyncStatus()
  const journals = new Map<string, IOutboxRepository>()
  const rows = ref(new Map<string, OutboxEntry>())

  const reload = async () => {
    const snapshot = new Map<string, OutboxEntry>()

    for (const [ownerId, outbox] of journals) {
      const unsettled = await outbox.listUnsettled({ ownerId })
      for (const row of unsettled) snapshot.set(keyOf(row.collection, row.docId), row)
    }

    rows.value = snapshot
  }

  // A run finishing is the moment the answers changed: rows were taken, or
  // refused with a reason the student is owed. Synchronously, because the
  // callback only starts a read and a screen asking right after a run must not
  // be given the answer from before it.
  watch(
    status.syncing,
    (now, before) => {
      if (before && !now) void reload()
    },
    { flush: 'sync' },
  )

  const track = (ownerId: string, outbox: IOutboxRepository) => {
    journals.set(ownerId, outbox)
    void reload()
  }

  const state = (collection: SyncCollection, docId: string): SubmissionState => {
    const row = rows.value.get(keyOf(collection, docId))
    return row === undefined ? 'accepted' : submissionStateOf(row.status, status.syncing.value)
  }

  const reason = (collection: SyncCollection, docId: string): SyncRejectionReason | undefined =>
    rows.value.get(keyOf(collection, docId))?.reason ?? undefined

  return { state, reason, track }
})
