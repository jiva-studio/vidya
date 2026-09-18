import type { SyncScopeRef, SyncScopeState } from '@vidya/domain'
import { syncScopeKey } from '@vidya/domain'
import { SYNC_DEFAULT_PULL_LIMIT, SYNC_MAX_PULL_LIMIT, type SyncCursors } from '@vidya/protocol'

import { applyPage, docKey, type PageOutcome } from './applyPage'
import { isSyncPausedError, type SyncEngineDeps } from './ports'
import { asStorableScope } from './scopeKeys'
import { NO_REQUIRED_FIELDS, type RequiredFields, type SkippedChange } from './validateChange'

/**
 * Fetching the server's changes, page by page, and merging them in.
 *
 * Copied in shape from Lectorium's `usecases/sync/pullAndMerge.ts` — the paging
 * loop, the one-transaction-per-page rule and the best-effort acknowledgement
 * are all its. What is ours is the read position: Lectorium keeps one number
 * for the whole journal, and we keep one per scope (I-3).
 *
 * That single change is what removes a whole feature. A course the student has
 * just been enrolled on is a scope standing at `0`, and its history arrives
 * through this ordinary pull. **There is no backfill** — no endpoint, no
 * scenario, no second notion of freshness to keep in step with the first.
 *
 * Two loop guards, and neither is optional:
 *
 * - A page that advanced no position and started no scope ends the run, even
 *   when the server says `hasMore` (D-19, AC-22m). Without it a server bug
 *   spins the device until the battery is flat.
 * - `maxPages` bounds a run that is making progress but has no end in sight,
 *   so one run cannot hold the app hostage.
 */

/** Pages one run will fetch before stopping, however much is left. */
export const MAX_PULL_PAGES = 100

export interface PullAndMergeOptions {
  /** Rows per page. Clamped to {@link SYNC_MAX_PULL_LIMIT}. */
  readonly limit?: number

  readonly maxPages?: number

  /** See {@link RequiredFields}; the device supplies its table projection. */
  readonly required?: RequiredFields
}

export interface PullAndMergeResult {
  readonly pages: number
  readonly applied: number

  /** Rows already superseded locally — handled, not lost (D-4). */
  readonly stale: number

  readonly skipped: readonly SkippedChange[]

  /** Scopes started at `0` this run: the whole of "a new course arrived". */
  readonly added: readonly SyncScopeRef[]

  /** Scopes withdrawn. Their downloaded rows are untouched (D-7, AC-22c). */
  readonly removed: readonly SyncScopeRef[]

  /** Scopes to refetch because their checksum disagrees (I-5, AC-10m). */
  readonly diverged: readonly SyncScopeRef[]

  /** `true` when the server said there was nothing further to send. */
  readonly reachedEnd: boolean

  /** `true` when the device suspended the database mid-run (D-14, AC-22i). */
  readonly paused: boolean

  /**
   * `true` when the positions were applied locally but the acknowledgement did
   * not reach the server. Nothing is lost: the ack is a compaction hint, and
   * the next run repeats it (T-N-6).
   */
  readonly ackFailed: boolean
}

export async function pullAndMerge(
  deps: SyncEngineDeps,
  options: PullAndMergeOptions = {},
): Promise<PullAndMergeResult> {
  const limit = clampLimit(options.limit)
  const maxPages = options.maxPages ?? MAX_PULL_PAGES
  const required = options.required ?? NO_REQUIRED_FIELDS
  const deviceId = await deps.state.getDeviceId()

  const totals = newTotals()

  for (let page = 0; page < maxPages; page += 1) {
    const before = await deps.state.listScopes()
    const response = await deps.client.pull({ deviceId, cursors: cursorsOf(before), limit })

    const outcome = await applyOnePage(deps, { response, before, required })
    if (outcome === null) {
      totals.paused = true
      break
    }

    collect(totals, outcome)
    if (!madeProgress(outcome)) break
    if (!response.hasMore) {
      totals.reachedEnd = true
      break
    }
  }

  // Not while the device is taking the database back: the acknowledgement is a
  // hint, and taking a lock on the way into the background is the one thing
  // D-14 forbids. The next run repeats it.
  totals.ackFailed = totals.paused ? false : await acknowledge(deps, deviceId)

  return toResult(totals)
}

/**
 * Run one page's transaction, answering `null` when the device took the
 * database away underneath us.
 *
 * A suspend is not a failure: every page committed so far stands, the scope
 * positions describing them are durable, and the run resumes from exactly here
 * when the app comes back (D-14, AC-22i). Anything else is a real error and
 * travels up untouched.
 */
async function applyOnePage(
  deps: SyncEngineDeps,
  input: {
    response: Awaited<ReturnType<SyncEngineDeps['client']['pull']>>
    before: readonly SyncScopeState[]
    required: RequiredFields
  },
): Promise<PageOutcome | null> {
  const pending = await pendingDocs(deps)

  try {
    return await applyPage(deps, { ...input, pending })
  } catch (error) {
    if (isSyncPausedError(error)) return null
    throw error
  }
}

/**
 * Documents whose local work is still only on this device.
 *
 * The merge needs it to know whether it may take the server's version whole or
 * has to keep this device's fields on top of it — which is what stops an
 * arriving review status from wiping out an answer that has not been sent yet
 * (AC-19, T-M-11).
 *
 * Asked of `listUnsettled`, not of `listPending`, and the difference is a
 * student's answer (D-5). A refused row stops being pending the moment the
 * answer is recorded, but a refusal delivered nothing: the text still exists
 * nowhere but here. Reading the pending list alone drops the document out of
 * this set, the next pull takes the server's empty copy whole, and the answer
 * disappears from the screen while its only remaining copy sits in an outbox
 * row no code ever reads back (AC-18).
 */
async function pendingDocs(deps: SyncEngineDeps): Promise<ReadonlySet<string>> {
  const rows = await deps.outbox.listUnsettled({ ownerId: deps.ownerId })
  return new Set(rows.map((row) => docKey(row.collection, row.docId)))
}

/**
 * Tell the server how far this device has read.
 *
 * Deliberately outside every transaction and deliberately forgiving. The
 * acknowledgement is an input to a future journal compaction and nothing else;
 * a failure here must not discard a merge that has already committed, so it is
 * reported and retried next run rather than thrown (T-N-6).
 *
 * The local counter is written only after the server confirmed, so a lost
 * answer repeats the ack instead of skipping it.
 */
async function acknowledge(deps: SyncEngineDeps, deviceId: string): Promise<boolean> {
  const scopes = await deps.state.listScopes()
  const highest = scopes.reduce((max, scope) => Math.max(max, scope.cursor), 0)
  if (highest <= (await deps.state.getAckedSeq())) return false

  try {
    await deps.client.ackCursor({ deviceId, ackedSeq: highest })
  } catch {
    // Reported, not swallowed: the caller sees `ackFailed` and the next run
    // repeats it. Rethrowing here would throw away a merge already committed.
    return true
  }

  await deps.unitOfWork(() => deps.state.setAckedSeq(highest))
  return false
}

/**
 * Positions of the scopes still granted. A withdrawn one is not asked about.
 *
 * A stored scope this build cannot name is not asked about either. Nothing
 * writes one any more (D-1), but a device that ran an earlier build may already
 * hold it, and one such row in the request is a `400` on every pull from then
 * on — reported as `refused`, which is "ours to fix, waiting will not help", so
 * the device would never receive another row. Leaving it out of the request is
 * the whole repair: the row stays, inert, and the pull works again.
 */
function cursorsOf(scopes: readonly SyncScopeState[]): SyncCursors {
  const cursors: Record<string, number> = {}
  for (const scope of scopes) {
    if (scope.removedAt !== null || asStorableScope(scope.scope) === null) continue
    cursors[syncScopeKey(scope.scope)] = scope.cursor
  }

  return cursors as SyncCursors
}

/**
 * Whether the page moved anything at all.
 *
 * A started scope counts as progress even with no rows: the next page is what
 * fetches its history, and stopping here would make a new course wait for the
 * next trigger for no reason.
 */
const madeProgress = (outcome: PageOutcome): boolean =>
  outcome.advanced.length > 0 || outcome.added.length > 0

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return SYNC_DEFAULT_PULL_LIMIT
  return Math.max(1, Math.min(SYNC_MAX_PULL_LIMIT, Math.floor(limit)))
}

interface Totals {
  pages: number
  applied: number
  stale: number
  skipped: SkippedChange[]
  added: SyncScopeRef[]
  removed: SyncScopeRef[]
  diverged: SyncScopeRef[]
  reachedEnd: boolean
  paused: boolean
  ackFailed: boolean
}

const newTotals = (): Totals => ({
  pages: 0,
  applied: 0,
  stale: 0,
  skipped: [],
  added: [],
  removed: [],
  diverged: [],
  reachedEnd: false,
  paused: false,
  ackFailed: false,
})

function collect(totals: Totals, outcome: PageOutcome): void {
  totals.pages += 1
  totals.applied += outcome.applied
  totals.stale += outcome.stale
  totals.skipped.push(...outcome.skipped)
  totals.added.push(...outcome.added)
  totals.removed.push(...outcome.removed)
  totals.diverged.push(...outcome.diverged)
}

const toResult = (totals: Totals): PullAndMergeResult => ({ ...totals })
