import type { OutboxEntry, OutboxStatus, SyncCollection } from '@vidya/domain'

/**
 * How far the student's own work has travelled towards the school.
 *
 * Both clients draw this differently and answer it the same way, so the answer
 * is worked out here and the drawing is left to them.
 */

/**
 * The device stores three statuses (`pending`, `pushed`, `rejected`); a screen
 * shows four, because "saved here" and "on its way right now" feel nothing
 * alike to somebody waiting. `sending` is therefore not a stored status but the
 * run in progress, passed in beside the row.
 */
export const SubmissionStates = ['notSent', 'sending', 'accepted', 'rejected'] as const

export type SubmissionState = (typeof SubmissionStates)[number]

/**
 * Names the state of one journaled row. `inFlight` is whether the push that
 * carries this very row is running, which only the sync engine knows.
 */
export function submissionStateOf(status: OutboxStatus, inFlight = false): SubmissionState {
  if (status === 'rejected') return 'rejected'
  if (status === 'pushed') return 'accepted'

  return inFlight ? 'sending' : 'notSent'
}

/** Addresses a document in a snapshot of the journal. */
export const outboxKeyOf = (collection: SyncCollection, docId: string): string =>
  `${collection}:${docId}`

/**
 * The last thing that happened to each document the journal still remembers.
 *
 * Rows are journaled in local order, so the highest `id` is the latest word on
 * a document. A refused row lives for ever, and keeping rows by list order
 * would let it bury the retry that was written after it.
 */
export function collectLatestOutboxRows(
  entries: readonly OutboxEntry[],
): ReadonlyMap<string, OutboxEntry> {
  const latest = new Map<string, OutboxEntry>()

  for (const row of entries) {
    const key = outboxKeyOf(row.collection, row.docId)
    const held = latest.get(key)
    if (held === undefined || held.id < row.id) latest.set(key, row)
  }

  return latest
}
