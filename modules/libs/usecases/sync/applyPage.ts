import {
  mergeIncoming,
  type SyncDoc,
  type SyncScopeKey,
  syncScopeKey,
  type SyncScopeRef,
  type SyncScopeState,
} from '@vidya/domain'
import type { PullResponse } from '@vidya/protocol'

import type { SyncEngineDeps } from './ports'
import {
  type RequiredFields,
  type SkippedChange,
  validateChange,
  type ValidChange,
} from './validateChange'

/**
 * Applying one pull page, inside one transaction.
 *
 * Three rules are enforced here rather than described anywhere else:
 *
 * - **The page and the positions it advances commit together** (D-18, AC-22l).
 *   Split them and a crash in between leaves the position ahead of the data it
 *   claims to describe, and the rows in that gap are never asked for again.
 * - **The transaction is exactly one page wide** (D-14, AC-22i). It opens after
 *   the response has arrived and closes before the next request goes out, so
 *   the SQLite lock is never held across a network round trip. iOS kills an app
 *   that is holding one when it is suspended, on a student's phone, silently.
 * - **The whole page applies; nothing is rolled back for one bad row** (D-13,
 *   AC-22h). Scope positions move independently, so homework legitimately
 *   arrives before the lesson version it answers. That order is legal, not an
 *   error, and the schema has no foreign keys precisely so that it stays legal.
 */

/** What one page did, in the terms the caller's loop decides on. */
export interface PageOutcome {
  readonly applied: number

  /** Rows `applyRemote` refused as not newer than what is on record (D-4). */
  readonly stale: number

  readonly skipped: readonly SkippedChange[]

  /** Scopes whose position moved. Empty means no progress (D-19, AC-22m). */
  readonly advanced: readonly SyncScopeRef[]

  /** Scopes the device had never heard of, now started at `0` (AC-21). */
  readonly added: readonly SyncScopeRef[]

  /** Scopes that left the caller's rights. Their data is untouched (D-7). */
  readonly removed: readonly SyncScopeRef[]

  /** Scopes whose checksum disagrees with ours — one to refetch (I-5). */
  readonly diverged: readonly SyncScopeRef[]

  /** Highest `serverSeq` seen anywhere in the page, for the acknowledgement. */
  readonly maxSeq: number
}

export interface ApplyPageInput {
  readonly response: PullResponse

  /** The scopes as they stood before this page — the comparison baseline. */
  readonly before: readonly SyncScopeState[]

  /** Documents this device still holds unsent writes for. */
  readonly pending: ReadonlySet<string>

  readonly required: RequiredFields
}

/** Key of a document in the pending-writes set. `\0` cannot occur in either half. */
export const docKey = (collection: string, docId: string): string => `${collection}\u0000${docId}`

export async function applyPage(deps: SyncEngineDeps, input: ApplyPageInput): Promise<PageOutcome> {
  const { response, before } = input
  const known = new Map(before.map((scope) => [syncScopeKey(scope.scope), scope]))

  const grants = response.scopes.map((grant) => grant.scope)
  const added = grants.filter((scope) => !known.has(syncScopeKey(scope)))
  const removed = removedScopes(before, grants, response.scopes.length > 0)

  return deps.unitOfWork(async () => {
    for (const scope of added) await deps.state.addScope(scope)
    for (const scope of removed) await deps.state.markScopeRemoved(scope, deps.now())

    const rows = await applyRows(deps, input)
    const positions = nextPositions(response, known, rows.seen)
    const diverged = divergedScopes(response, known, positions)

    for (const [key, position] of positions) {
      await deps.state.setScopeCursor(position.scope, position.cursor, checksumOf(response, key))
    }

    return {
      applied: rows.applied,
      stale: rows.stale,
      skipped: rows.skipped,
      advanced: [...positions.values()]
        .filter((position) => position.advanced)
        .map((position) => position.scope),
      added,
      removed,
      diverged,
      maxSeq: rows.maxSeq,
    }
  })
}

interface RowOutcome {
  applied: number
  stale: number
  skipped: SkippedChange[]
  /** Highest `serverSeq` observed per scope, skipped rows included. */
  seen: Map<SyncScopeKey, number>
  maxSeq: number
}

/**
 * Merge and write every row of the page.
 *
 * A row that fails validation is stepped over and recorded; a row `applyRemote`
 * finds stale is counted and stepped over too. Both still move the position of
 * their scope, because both have been *handled*: leaving the position behind
 * would fetch them again on the next page, forever.
 */
async function applyRows(deps: SyncEngineDeps, input: ApplyPageInput): Promise<RowOutcome> {
  const outcome: RowOutcome = { applied: 0, stale: 0, skipped: [], seen: new Map(), maxSeq: 0 }

  for (const change of input.response.changes) {
    const verdict = validateChange(change, input.required)
    if (verdict.verdict === 'skip') {
      outcome.skipped.push({
        serverSeq: change.serverSeq,
        collection: String(change.collection),
        docId: String(change.docId),
        reason: verdict.reason,
        detail: verdict.detail,
      })
      noteSeq(outcome, change.scope, change.serverSeq)
      continue
    }

    const written = await applyOne(deps, verdict.change, input.pending)
    if (written) outcome.applied += 1
    else outcome.stale += 1
    noteSeq(outcome, verdict.change.scope, verdict.change.serverSeq)
  }

  return outcome
}

/**
 * Merge one incoming version into the local one and write it unjournaled.
 *
 * The server pointer recorded is the **remote** HLC, never the merged
 * document's: a merge that kept this device's unsent text still descends from
 * the server version it was merged with, and that is what the next push has to
 * declare as its `baseHlc`.
 */
async function applyOne(
  deps: SyncEngineDeps,
  change: ValidChange,
  pending: ReadonlySet<string>,
): Promise<boolean> {
  const remote: SyncDoc = {
    docId: change.docId,
    hlc: change.hlc,
    deleted: change.op === 'delete',
    data: change.data,
  }

  const local = await deps.apply.getLocalDoc(change.collection, change.docId)
  const merged = mergeIncoming(
    change.collection,
    local,
    remote,
    pending.has(docKey(change.collection, change.docId)),
  )

  return deps.apply.applyRemote(change.collection, merged, remote.hlc)
}

function noteSeq(outcome: RowOutcome, scope: unknown, seq: number): void {
  if (!Number.isFinite(seq)) return
  outcome.maxSeq = Math.max(outcome.maxSeq, seq)

  const ref = scope as SyncScopeRef | undefined
  if (ref === undefined || typeof ref?.kind !== 'string' || typeof ref?.id !== 'string') return

  const key = syncScopeKey(ref)
  outcome.seen.set(key, Math.max(outcome.seen.get(key) ?? 0, seq))
}

interface ScopePosition {
  readonly scope: SyncScopeRef
  readonly cursor: number
  readonly advanced: boolean
}

/**
 * Where each scope stands after this page.
 *
 * Three sources, and the highest wins: what the device already had, what the
 * server says the page reached, and the highest sequence actually seen in the
 * rows. The last one is why a page delivered out of order still leaves the
 * position at the maximum rather than at the last row (T-X-10), and the middle
 * one is what carries a position past rows this build skipped.
 */
function nextPositions(
  response: PullResponse,
  known: ReadonlyMap<string, SyncScopeState>,
  seen: ReadonlyMap<SyncScopeKey, number>,
): Map<SyncScopeKey, ScopePosition> {
  const positions = new Map<SyncScopeKey, ScopePosition>()

  const consider = (key: SyncScopeKey, candidate: number) => {
    const scope = scopeOf(key, known)
    if (scope === null) return

    const current = known.get(key)?.cursor ?? 0
    const existing = positions.get(key)?.cursor ?? current
    const cursor = Math.max(existing, candidate, current)
    positions.set(key, { scope, cursor, advanced: cursor > current })
  }

  for (const [key, cursor] of Object.entries(response.cursors)) {
    consider(key as SyncScopeKey, Number(cursor))
  }
  for (const [key, seq] of seen) consider(key, seq)

  return positions
}

/**
 * Scopes whose checksum no longer matches ours.
 *
 * Compared only where the position did **not** move: a scope standing at the
 * head with unchanged content must report the same summary it reported before,
 * so a different one means this device is missing something (I-5, AC-10m). A
 * scope that did advance is expected to have a new checksum and says nothing.
 * The first checksum ever seen for a scope is recorded, never judged.
 */
function divergedScopes(
  response: PullResponse,
  known: ReadonlyMap<string, SyncScopeState>,
  positions: ReadonlyMap<SyncScopeKey, ScopePosition>,
): SyncScopeRef[] {
  const diverged: SyncScopeRef[] = []

  for (const [key, checksum] of Object.entries(response.checksums)) {
    const previous = known.get(key)
    if (previous === undefined || previous.checksum === null) continue
    if (positions.get(key as SyncScopeKey)?.advanced === true) continue
    if (previous.checksum !== checksum) diverged.push(previous.scope)
  }

  return diverged
}

/**
 * Scopes the device follows that the server no longer grants.
 *
 * Only computed when the answer actually carried a grant list: an empty
 * `scopes` is how a page says "nothing to report about rights", and treating it
 * as "you have been withdrawn from everything" would mark every course gone.
 */
function removedScopes(
  before: readonly SyncScopeState[],
  grants: readonly SyncScopeRef[],
  reported: boolean,
): SyncScopeRef[] {
  if (!reported) return []

  const granted = new Set(grants.map(syncScopeKey))
  return before
    .filter((scope) => scope.removedAt === null && !granted.has(syncScopeKey(scope.scope)))
    .map((scope) => scope.scope)
}

function scopeOf(
  key: SyncScopeKey,
  known: ReadonlyMap<string, SyncScopeState>,
): SyncScopeRef | null {
  const existing = known.get(key)
  if (existing !== undefined) return existing.scope

  const separator = key.indexOf(':')
  if (separator < 1 || separator === key.length - 1) return null

  return { kind: key.slice(0, separator) as SyncScopeRef['kind'], id: key.slice(separator + 1) }
}

const checksumOf = (response: PullResponse, key: SyncScopeKey): string | null =>
  response.checksums[key] ?? null
