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
import { asStorableScope, scopeFromKey } from './scopeKeys'
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
 * - **The page and the positions it advances commit together**.
 *   Split them and a crash in between leaves the position ahead of the data it
 *   claims to describe, and the rows in that gap are never asked for again.
 * - **The transaction is exactly one page wide**. It opens after
 *   the response has arrived and closes before the next request goes out, so
 *   the SQLite lock is never held across a network round trip. iOS kills an app
 *   that is holding one when it is suspended, on a student's phone, silently.
 * - **The whole page applies; nothing is rolled back for one bad row.** Scope
 *   positions move independently, so homework legitimately arrives before the
 *   lesson version it answers. That order is legal, not an error, and the
 *   schema has no foreign keys precisely so that it stays legal.
 */

/** What one page did, in the terms the caller's loop decides on. */
export interface PageOutcome {
  readonly applied: number

  /** Rows `applyRemote` refused as not newer than what is on record. */
  readonly stale: number

  readonly skipped: readonly SkippedChange[]

  /** Scopes whose position moved. Empty means no progress. */
  readonly advanced: readonly SyncScopeRef[]

  /** Scopes the device had never heard of, now started at `0`. */
  readonly added: readonly SyncScopeRef[]

  /** Scopes that left the caller's rights. Their rows left with them. */
  readonly removed: readonly SyncScopeRef[]

  /** Scopes whose checksum disagrees with ours — one to refetch. */
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

  const grants = storableGrants(response)
  const added = grants.filter((scope) => !known.has(syncScopeKey(scope)))
  const restored = grants.filter((scope) => known.get(syncScopeKey(scope))?.removedAt != null)
  const removed = removedScopes(before, grants)

  return deps.unitOfWork(async () => {
    for (const scope of added) await deps.state.addScope(scope)
    for (const scope of restored) await deps.state.restoreScope(scope)
    for (const scope of removed) {
      await deps.state.purgeScope(scope)
      await deps.state.markScopeRemoved(scope, deps.now())
    }

    const rows = await applyRows(deps, input)
    const positions = nextPositions(response, known, rows.seen)
    const diverged = divergedScopes(response, known, positions)

    for (const [key, position] of positions) {
      await deps.state.setScopeCursor(
        position.scope,
        position.cursor,
        checksumFor(response, key, rows),
      )
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

  /** Scopes this page stepped over a row of — see {@link checksumFor}. */
  missing: Set<SyncScopeKey>
  maxSeq: number
}

/**
 * Stored in place of a scope summary the device has not earned.
 *
 * Deliberately not a checksum: no digest the server can compute is equal to it,
 * so the comparison that follows can only come out "different".
 */
export const INCOMPLETE_CHECKSUM = '!incomplete'

/**
 * Merge and write every row of the page.
 *
 * A row that fails validation is stepped over and recorded; a row `applyRemote`
 * finds stale is counted and stepped over too. Both still move the position of
 * their scope, because both have been *handled*: leaving the position behind
 * would fetch them again on the next page, forever.
 */
async function applyRows(deps: SyncEngineDeps, input: ApplyPageInput): Promise<RowOutcome> {
  const outcome: RowOutcome = {
    applied: 0,
    stale: 0,
    skipped: [],
    seen: new Map(),
    missing: new Set(),
    maxSeq: 0,
  }

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
      noteMissing(outcome, change.scope)
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

    // `data` already carries the envelope's school: validateChange folds it in
    // before the required-field check, so every collection is stored the same
    // way whether or not its document repeats the school.
    data: change.data,
  }

  const local = await deps.apply.getLocalDoc(change.collection, change.docId)
  const merged = mergeIncoming(
    change.collection,
    local,
    remote,
    pending.has(docKey(change.collection, change.docId)),
  )

  return deps.apply.applyRemote(change.collection, merged, remote.hlc, change.scope)
}

/** Record that a scope of this page is short a row this build did not store. */
function noteMissing(outcome: RowOutcome, scope: unknown): void {
  const ref = asStorableScope(scope)
  if (ref !== null) outcome.missing.add(syncScopeKey(ref))
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
 * position at the maximum rather than at the last row, and the middle
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
 * so a different one means this device is missing something. A
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
 * `scopes` is mandatory on the wire and states the caller's rights as they
 * stand, so an empty list is a member who holds nothing rather than a page
 * with nothing to say. Read the other way, the loss of the *last* role is the
 * one withdrawal that would never reach the device at all.
 *
 * The price is named: a build that cannot read a kind a newer server grants
 * counts it as withdrawn and erases data the caller is entitled to. A new
 * scope kind therefore ships behind a client version, never on its own.
 */
function removedScopes(
  before: readonly SyncScopeState[],
  grants: readonly SyncScopeRef[],
): SyncScopeRef[] {
  const granted = new Set(grants.map(syncScopeKey))
  return before
    .filter((scope) => scope.removedAt === null && !granted.has(syncScopeKey(scope.scope)))
    .map((scope) => scope.scope)
}

/**
 * The scope a cursor key names, or `null` when this build cannot store it.
 *
 * Checked rather than cast. The key comes from the server's answer, and
 * whatever is stored here is handed back as a cursor on every later pull: a
 * kind this build does not know, or an id that is not a UUID, is a request the
 * server cannot answer, and the `400` it replies with stops the pull for good
 * — there is no path that would ever take the row out again.
 */
function scopeOf(
  key: SyncScopeKey,
  known: ReadonlyMap<string, SyncScopeState>,
): SyncScopeRef | null {
  const existing = known.get(key)

  return existing === undefined ? scopeFromKey(key) : asStorableScope(existing.scope)
}

/** The grants of this answer, minus any this build would refuse to store. */
function storableGrants(response: PullResponse): SyncScopeRef[] {
  const grants: SyncScopeRef[] = []
  for (const grant of response.scopes) {
    const scope = asStorableScope(grant.scope)
    if (scope !== null) grants.push(scope)
  }

  return grants
}

/**
 * The checksum to record for a scope this page moved.
 *
 * The server's summary describes the server's rows; claiming it is a statement
 * that this device now holds them all. A page that stepped over a row of this
 * scope has not, so the sentinel goes down instead: the position still moves —
 * a skipped row is handled, not lost — but the next pull finds a summary that
 * cannot match, reports the scope diverged and refetches it from `0`. Recording
 * the server's summary over incomplete data blinds that detector permanently,
 * which is how a single skipped lesson version becomes content the student
 * never sees.
 *
 * A row refused as stale is *not* missing: `applyRemote` refuses it because the
 * device already holds that version or a newer one, so the content is there and
 * the summary is honestly ours to claim. Treating it as a gap would make every
 * refetch end in a scope that disagrees with itself and refetch again, forever.
 */
const checksumFor = (response: PullResponse, key: SyncScopeKey, rows: RowOutcome): string | null =>
  rows.missing.has(key) ? INCOMPLETE_CHECKSUM : (response.checksums[key] ?? null)
