import type { OutboxAcknowledgement, OutboxEntry } from '@vidya/domain'
import { type PushChange, type PushResult, SYNC_MAX_PUSH_CHANGES } from '@vidya/protocol'

import { isSyncPausedError, type SyncEngineDeps } from './ports'

/**
 * Draining the local journal to the server.
 *
 * Copied in shape from Lectorium's `usecases/sync/pushLocal.ts`: the rounds,
 * the watermark re-read inside the transaction, and the contiguity rule that
 * keeps the watermark honest. What is gone is its conflict re-merge — there is
 * nothing to re-merge here, because the writing sides are split and the server
 * answers each row `accepted` or `rejected` rather than handing back a master.
 *
 * Two invariants this file exists to hold:
 *
 * - **No outbox row is ever deleted, on any path**. An accepted
 *   row is marked `pushed`; a refused one keeps its reason and stays on the
 *   device, where the student's work is. The watermark is what stops a refused
 *   row being sent forever — not a delete.
 * - **The watermark may only cover a contiguous run of answered rows.** A row
 *   the server answered about neither way would let the rows behind it be
 *   stepped over without ever having been sent, so the batch is refused whole
 *   before anything is written: `assertAnswersMatch` throws, nothing moves, and
 *   every row stays pending. There is no half-answered batch to record.
 */

/** Rows one round sends. Never above the contract's ceiling. */
export const PUSH_BATCH = Math.min(200, SYNC_MAX_PUSH_CHANGES)

/** Rounds one run drains before leaving the rest to the next trigger. */
export const MAX_PUSH_ROUNDS = 5

export interface PushLocalResult {
  readonly rounds: number
  readonly sent: number
  readonly accepted: number
  readonly rejected: number

  /**
   * How far this device's own rows have reached the journal.
   * The interface must not paint a state below this id, or it would show a
   * lesson without the answer the student just wrote.
   */
  readonly journaledOutboxId: number

  /** `true` when the device suspended the database mid-run. */
  readonly paused: boolean
}

/** Thrown when a push answer does not match the batch it answers. */
export class PushContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PushContractError'
  }
}

export async function pushLocal(deps: SyncEngineDeps): Promise<PushLocalResult> {
  const deviceId = await deps.state.getDeviceId()
  const totals = {
    rounds: 0,
    sent: 0,
    accepted: 0,
    rejected: 0,

    // The watermark, not zero. A run with nothing to send is the ordinary
    // case — the student has typed nothing since the last one — and it has to
    // answer "how far have my rows reached the journal" with what the device
    // already knows, which is the id every answered row sits at or below. Zero
    // is the answer for a device that has never pushed anything, and reporting
    // it after an empty round tells the interface the journal is missing work
    // it took long ago, so the screen stops painting for good.
    journaledOutboxId: await deps.state.getPushedOutboxId(),
    paused: false,
  }

  for (let round = 0; round < MAX_PUSH_ROUNDS; round += 1) {
    const watermark = await deps.state.getPushedOutboxId()
    const pending = await deps.outbox.listPending(
      { ownerId: deps.ownerId, afterId: watermark },
      PUSH_BATCH,
    )
    if (pending.length === 0) break

    const response = await deps.client.push({
      deviceId,
      changes: await toChanges(deps, pending),
    })

    assertAnswersMatch(pending, response.results)

    const recorded = await record(deps, pending, response.results)
    if (recorded === null) {
      totals.paused = true
      break
    }

    totals.rounds += 1
    totals.sent += pending.length
    totals.accepted += recorded.accepted
    totals.rejected += recorded.rejected
    totals.journaledOutboxId = Math.max(totals.journaledOutboxId, response.journaledOutboxId)

    if (pending.length < PUSH_BATCH) break
  }

  return totals
}

/**
 * Turn journaled rows into wire changes.
 *
 * `baseHlc` is re-read here rather than taken from the row, because the pull
 * may have moved the document's server pointer since the edit was journaled.
 * The fresher value is what lets the server tell an edit of the version it
 * holds from an edit of one two revisions old; the journaled value is the
 * fallback for a document the pull has never touched.
 */
async function toChanges(
  deps: SyncEngineDeps,
  pending: readonly OutboxEntry[],
): Promise<PushChange[]> {
  const changes: PushChange[] = []

  for (const entry of pending) {
    changes.push({
      outboxId: entry.id,
      collection: entry.collection,
      docId: entry.docId,
      op: entry.op,
      data: entry.op === 'delete' ? null : entry.data,
      hlc: entry.hlc,
      baseHlc: (await deps.apply.lastServerHlc(entry.collection, entry.docId)) ?? entry.baseHlc,
    })
  }

  return changes
}

interface Recorded {
  readonly accepted: number
  readonly rejected: number
}

/**
 * Write the server's answers back, in one transaction.
 *
 * An accepted row gets its `serverHlc` recorded as the document's pointer — the
 * push has just made this device's change the version the server holds, and the
 * next edit has to descend from it. A refused row keeps its reason. Neither is
 * removed, and the watermark is re-read inside the transaction so a value
 * raised while the request was in flight is not written back down.
 *
 * Answers are read by position, because that is what the contract says they
 * are and what {@link assertAnswersMatch} has just proved of this batch: one
 * answer per row, in the order sent. That check is also what keeps the
 * watermark honest — a batch with a row unanswered never reaches here at all,
 * so the run of answered rows this moves over cannot have a hole in it.
 */
async function record(
  deps: SyncEngineDeps,
  pending: readonly OutboxEntry[],
  results: readonly PushResult[],
): Promise<Recorded | null> {
  try {
    return await deps.unitOfWork(async () => {
      const acknowledgements: OutboxAcknowledgement[] = []
      let accepted = 0

      for (const [index, entry] of pending.entries()) {
        const result = results[index]!
        if (result.status === 'accepted') {
          await deps.apply.recordServerHlc(entry.collection, entry.docId, result.serverHlc)
          accepted += 1
          acknowledgements.push({ id: entry.id, status: 'pushed' })
        } else {
          acknowledgements.push({ id: entry.id, status: 'rejected', reason: result.reason })
        }
      }

      await deps.outbox.acknowledge(acknowledgements)
      await advanceWatermark(deps, pending.at(-1)?.id ?? 0)

      return { accepted, rejected: acknowledgements.length - accepted }
    })
  } catch (error) {
    if (isSyncPausedError(error)) return null
    throw error
  }
}

/** Move the watermark, never backwards. Re-reads inside the transaction. */
async function advanceWatermark(deps: SyncEngineDeps, watermark: number): Promise<void> {
  if (watermark === 0) return

  const current = await deps.state.getPushedOutboxId()
  if (watermark > current) await deps.state.setPushedOutboxId(watermark)
}

/**
 * The contract says one answer per row, in the order sent.
 *
 * Checked rather than assumed: a mismatch means the device and the server
 * disagree about what was just written, and guessing would mark the wrong rows
 * pushed. Failing loudly leaves every row pending and the watermark where it
 * was, which is the safe state.
 */
function assertAnswersMatch(pending: readonly OutboxEntry[], results: readonly PushResult[]): void {
  if (results.length !== pending.length) {
    throw new PushContractError(
      `push answered ${results.length} rows for a batch of ${pending.length}`,
    )
  }

  for (let index = 0; index < pending.length; index += 1) {
    if (results[index]!.outboxId !== pending[index]!.id) {
      throw new PushContractError(
        `push answer ${index} names outbox row ${results[index]!.outboxId}, not ${pending[index]!.id}`,
      )
    }
  }
}

/**
 * Whether the journal already holds every row this device has written.
 *
 * The interface asks this before painting: `false` means the state on the
 * server does not yet contain the answer the student just typed, and showing it
 * would show their work missing.
 */
export const journalHasLocalWrites = (journaledOutboxId: number, latestOutboxId: number): boolean =>
  latestOutboxId === 0 || journaledOutboxId >= latestOutboxId
