import { collectLatestOutboxRows, outboxKeyOf } from '@vidya/client'
import type {
  IOutboxRepository,
  OutboxEntry,
  SyncCollection,
  SyncRejectionReason,
} from '@vidya/domain'
import { createGlobalState } from '@vueuse/core'
import { ref, watch } from 'vue'

import { useSyncStatus } from './syncStatus'

/**
 * How far each journaled row has travelled, as a screen asks about it.
 *
 * A screen holds a document, not an outbox row, so the question is always
 * "what happened to this document" — and the answer has to be there when the
 * row is rendered rather than a promise. The journal is therefore read into a
 * snapshot and re-read when a run finishes.
 *
 * Two readings are held: the rows still waiting to be sent, and the refused
 * ones, which no later push will carry. A document with neither was taken by
 * the server, and only then is it accepted. Where both readings name one
 * document, the later row answers for it: a refusal is the last word only
 * until the student writes again.
 */
export interface OutboxView {
  state(collection: SyncCollection, docId: string): SubmissionState
  reason(collection: SyncCollection, docId: string): SyncRejectionReason | undefined

  /** Reads this identity's journal, and keeps reading it after every run. */
  track(ownerId: string, outbox: IOutboxRepository): void

  /** Reads it again now — after a local write, which no run has seen yet. */
  refresh(): void
}

export const useOutboxView = createGlobalState((): OutboxView => {
  const status = useSyncStatus()
  const journals = new Map<string, IOutboxRepository>()
  const rows = ref<ReadonlyMap<string, OutboxEntry>>(new Map())

  const reload = async () => {
    const journaled: OutboxEntry[] = []

    for (const [ownerId, outbox] of journals) {
      journaled.push(...(await outbox.listUnsettled({ ownerId })))
      journaled.push(...(await outbox.listDead({ ownerId })))
    }

    rows.value = collectLatestOutboxRows(journaled)
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
    const row = rows.value.get(outboxKeyOf(collection, docId))
    return row === undefined ? 'accepted' : submissionStateOf(row.status, status.syncing.value)
  }

  const reason = (collection: SyncCollection, docId: string): SyncRejectionReason | undefined =>
    rows.value.get(outboxKeyOf(collection, docId))?.reason ?? undefined

  return { state, reason, track, refresh: () => void reload() }
})
