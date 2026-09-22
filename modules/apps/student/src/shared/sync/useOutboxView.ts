import type { SubmissionState } from '@vidya/client'
import { collectLatestOutboxRows, outboxKeyOf, submissionStateOf } from '@vidya/client'
import type {
  IOutboxRepository,
  OutboxEntry,
  SyncCollection,
  SyncRejectionReason,
} from '@vidya/domain'
import { createGlobalState } from '@vueuse/core'
import { ref, watch } from 'vue'

import { useSiteStatus } from '@/shared/status'

/**
 * How far each record this tab wrote has travelled, as a screen asks about it.
 *
 * A screen holds a document, not a journal row, so the question is always "what
 * happened to this document" — and the answer has to be there when the row is
 * drawn rather than a promise. The journal is therefore read into a snapshot
 * and read again whenever a run finishes.
 *
 * One journal, because a tab has one connection. Both readings are taken — the
 * rows still waiting to be sent and the refused ones, which no later push will
 * carry — and a document in neither was taken by the server.
 */
export interface OutboxView {
  state(collection: SyncCollection, docId: string): SubmissionState
  reason(collection: SyncCollection, docId: string): SyncRejectionReason | undefined

  /** Offered by the writing tab while its engine lives, withdrawn when it stops. */
  adoptJournal(ownerId: string, outbox: IOutboxRepository): void
  forgetJournal(): void

  /** Reads it again now — after a local write, which no run has seen yet. */
  refresh(): void
}

export const useOutboxView = createGlobalState((): OutboxView => {
  const status = useSiteStatus()
  const rows = ref<ReadonlyMap<string, OutboxEntry>>(new Map())
  let journal: { ownerId: string; outbox: IOutboxRepository } | undefined

  const reload = async (): Promise<void> => {
    if (journal === undefined) {
      rows.value = new Map()
      return
    }

    const { ownerId, outbox } = journal
    const journaled = [
      ...(await outbox.listUnsettled({ ownerId })),
      ...(await outbox.listDead({ ownerId })),
    ]

    rows.value = collectLatestOutboxRows(journaled)
  }

  // A run finishing is the moment the answers changed: rows were taken, or
  // refused with a reason the student is owed. The watch is synchronous so a
  // screen asking right after a run is not given the answer from before it.
  watch(
    status.syncing,
    (now, before) => {
      if (before && !now) void reload()
    },
    { flush: 'sync' },
  )

  return {
    state: (collection, docId) => {
      const row = rows.value.get(outboxKeyOf(collection, docId))
      return row === undefined ? 'accepted' : submissionStateOf(row.status, status.syncing.value)
    },

    reason: (collection, docId) =>
      rows.value.get(outboxKeyOf(collection, docId))?.reason ?? undefined,

    adoptJournal: (ownerId, outbox) => {
      journal = { ownerId, outbox }
      void reload()
    },

    forgetJournal: () => {
      journal = undefined
      void reload()
    },

    refresh: () => void reload(),
  }
})
