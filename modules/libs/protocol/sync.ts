/**
 * The sync wire contract: `pull`, `push` and `cursor`.
 *
 * Three things a reader should not have to discover by experiment:
 *
 * - **The read position is a map, not a number.** A client keeps one position
 *   per scope. A course they have just been enrolled on is simply a scope
 *   standing at `0`, and its history arrives through an ordinary pull; there is
 *   no backfill endpoint.
 * - **A push is answered row by row.** `results` has the length of `changes`
 *   and the same order, and every element is either accepted with the HLC the
 *   server stored, or refused with a reason. A refusal never rolls back its
 *   neighbours: one rejected answer must not hold up the video progress
 *   travelling beside it.
 * - **Every instant is UTC**, as `IsoDateTime` — ISO 8601, milliseconds,
 *   always `Z`. HLCs carry unix milliseconds, which are UTC by construction. A
 *   local time anywhere here would reorder rows for a traveller.
 *
 * The fixtures under `__fixtures__/sync/` are part of this contract and move
 * with it.
 */

import * as domain from '@vidya/domain'

import { ErrorResponse } from './error'

/* -------------------------------------------------------------------------- */
/*                            The shared vocabulary                           */
/* -------------------------------------------------------------------------- */

/**
 * Collections, operations, scopes and rejection reasons are declared in
 * `@vidya/domain` and re-exported here, the way lesson content is: the device
 * stores them as well as sends them, so the merge rules and the wire cannot be
 * allowed to drift into two vocabularies. Clients keep importing them from
 * `@vidya/protocol`.
 */
export type {
  SyncCollection,
  SyncOp,
  SyncPayload,
  SyncRejectionReason,
  SyncScopeKey,
  SyncScopeKind,
  SyncScopeRef,
} from '@vidya/domain'
export {
  isSyncCollection,
  isSyncRejectionReason,
  parseSyncScopeKey,
  SyncCollections,
  SyncOps,
  SyncRejectionReasons,
  syncScopeKey,
  SyncScopeKinds,
} from '@vidya/domain'

/* -------------------------------------------------------------------------- */
/*                                   Limits                                   */
/* -------------------------------------------------------------------------- */

/** Rows per pull page when the client asks for no particular size. */
export const SYNC_DEFAULT_PULL_LIMIT = 200

/** Hard ceiling on a pull page; a larger `limit` is clamped, not refused. */
export const SYNC_MAX_PULL_LIMIT = 500

/** Rows one push may carry. Beyond it the request is refused as malformed. */
export const SYNC_MAX_PUSH_CHANGES = 500

/**
 * Ceiling on one serialized row's `data`. A lesson version with a
 * hundred blocks travels as one row, and without a ceiling the first heavy
 * lesson takes the whole page down.
 */
export const SYNC_MAX_CHANGE_BYTES = 1_048_576

/** Ceiling on a whole push body. */
export const SYNC_MAX_BATCH_BYTES = 4_194_304

/**
 * Ceiling on the scopes one request may carry. The positions travel in
 * the body and grow with the number of courses a student takes, so the limit is
 * named here rather than discovered when a request stops fitting. Exceeding it
 * is an error with a reason, never a silently truncated list.
 */
export const SYNC_MAX_SCOPES = 200

/**
 * How far ahead of the server's own clock an incoming HLC may sit before the
 * server restamps it. One device whose clock is a year fast would
 * otherwise anchor the ordering of the whole system in the future, because
 * every other device seeds its clock from the highest HLC it has seen and an
 * HLC's physical part never goes back down.
 */
export const SYNC_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

/**
 * Read positions, keyed by `<kind>:<id>` — `course:8f1e…`, `user:3c0a…`. The
 * value is the highest `serverSeq` of that scope the client has applied; `0`,
 * or an absent key, means "from the beginning".
 */
export type SyncCursors = { readonly [scope: domain.SyncScopeKey]: number }

/** Per-scope checksums, keyed the same way. */
export type SyncChecksums = { readonly [scope: domain.SyncScopeKey]: string }

/**
 * One journaled change on its way down.
 *
 * `scope` is present because the client advances the position of *that* scope
 * and no other; a page mixing scopes is normal and each row says where it
 * belongs. `data` is `null` exactly when `op` is `delete`.
 */
export type SyncChange = {
  /** The journal's `global_seq` — monotonic, and the position within the scope. */
  serverSeq: number

  collection: domain.SyncCollection
  docId: string
  op: domain.SyncOp
  data: domain.SyncPayload | null

  /** The stamp the row was written with, in the domain's HLC format. */
  hlc: string

  scope: domain.SyncScopeRef

  /** The school the row belongs to: one local database holds several. */
  schoolId: domain.SchoolId

  /** When the row was journaled. UTC. */
  createdAt: domain.IsoDateTime
}

/** A scope the caller is currently entitled to, as the server sees it now. */
export type SyncScopeGrant = {
  scope: domain.SyncScopeRef

  /** Highest `serverSeq` the server holds for this scope right now. */
  headSeq: number
}

/* -------------------------------------------------------------------------- */
/*                                    Pull                                    */
/* -------------------------------------------------------------------------- */

export type PullRequest = {
  /** Identifies the writer, so its own rows are not echoed back to it. */
  deviceId: string

  /** Where this device stands per scope. An unknown scope starts at `0`. */
  cursors: SyncCursors

  /** Rows wanted; clamped to {@link SYNC_MAX_PULL_LIMIT}. */
  limit?: number
}

/**
 * A pull page.
 *
 * `cursors` carries back the position for every scope this page advanced, so a
 * client never has to compute it from the rows. `scopes` is the caller's rights
 * as they stand now: a scope that appears is started at `0`, a scope that
 * disappears is marked gone and **its data is left alone**. `checksums`
 * let a device notice a scope has diverged and fetch that one scope again
 * rather than the whole database.
 *
 * `hasMore` says only that the server has more rows ready. A client must also
 * stop when a page advanced no position at all, or a server bug turns into a
 * loop that drains the battery.
 */
export type PullResponse = {
  changes: SyncChange[]
  cursors: SyncCursors
  scopes: SyncScopeGrant[]
  checksums: SyncChecksums
  hasMore: boolean
}

/* -------------------------------------------------------------------------- */
/*                                    Push                                    */
/* -------------------------------------------------------------------------- */

/**
 * One local change on its way up.
 *
 * `outboxId` is the row's local journal id. It travels so the server can report
 * how far this device's own writes have reached the journal, and because the
 * server applies a batch strictly in array order — two offline edits of
 * one document must land in the order they were made.
 */
export type PushChange = {
  outboxId: number
  collection: domain.SyncCollection
  docId: string
  op: domain.SyncOp
  data: domain.SyncPayload | null
  hlc: string

  /** The last server HLC this change derived from; `null` when the doc is new here. */
  baseHlc: string | null
}

export type PushRequest = {
  deviceId: string
  changes: PushChange[]
}

/**
 * A row the server stored.
 *
 * `serverHlc` is returned **always**, not only when it differs from what was
 * sent, and the client records it as the document's server pointer. It can
 * differ for two reasons, and the client does not need to tell them apart: the
 * incoming stamp sat further ahead than {@link SYNC_CLOCK_SKEW_TOLERANCE_MS}
 * allows, or the same HLC already named a row with a *different* body,
 * which is what two devices restored from one backup produce. In both
 * cases the server restamps and keeps both records — a write is never swallowed
 * by the idempotency index as an imagined repeat.
 *
 * A genuine repeat — same HLC, same body — is accepted without storing anything
 * a second time, so a push replayed after a dropped connection is free.
 */
export type PushAccepted = {
  outboxId: number
  collection: domain.SyncCollection
  docId: string
  status: 'accepted'

  /** The HLC the journal holds for this row. May differ from the one sent. */
  serverHlc: string

  /** `true` when the server assigned a new stamp rather than keeping the sent one. */
  restamped: boolean

  /**
   * The id the server actually wrote under, present only when it differs from
   * `docId`.
   *
   * A device names the work it writes offline, so two devices of one student can
   * hand in the same section under two ids. The table's key is the natural one
   * (`enrolment`, `version`, `section`), so the second push lands on the row the
   * first created.
   *
   * Absent means "written under the id you sent". Present means "your row and
   * mine are the same row, and this is its name": the device renames its local
   * row and its outbox entries to this id, instead of keeping one no pull
   * carries and no tombstone removes.
   */
  serverDocId?: string
}

/**
 * A row the server refused. The work stays on the device: the reason is a state
 * of the row, shown on the answer itself, and never a lost edit.
 */
export type PushRejected = {
  outboxId: number
  collection: domain.SyncCollection
  docId: string
  status: 'rejected'
  reason: domain.SyncRejectionReason

  /** Optional human-readable detail; the client shows the reason, not this. */
  detail?: string
}

export type PushResult = PushAccepted | PushRejected

/**
 * Answers in the order the rows were sent, one per row.
 *
 * `journaledOutboxId` is the write checkpoint: every row of this device
 * up to and including that id is now in the journal, so the interface can
 * refuse to paint a state that does not yet contain the answer just written.
 * It is `0` when the batch was empty.
 */
export type PushResponse = {
  results: PushResult[]
  journaledOutboxId: number
}

/* -------------------------------------------------------------------------- */
/*                                   Cursor                                   */
/* -------------------------------------------------------------------------- */

/**
 * Acknowledges the highest `serverSeq` this device has applied across all
 * scopes — the input a future journal compaction would need. Answered with
 * `204` and no body.
 */
export type AckCursorRequest = {
  deviceId: string
  ackedSeq: number
}

/* -------------------------------------------------------------------------- */
/*                             Whole-request errors                           */
/* -------------------------------------------------------------------------- */

/**
 * The few failures that are not per-row. A malformed row is refused by itself;
 * these describe a request that could not be read at all.
 */
export const SyncRequestErrorCodes = [
  /** More scopes than {@link SYNC_MAX_SCOPES}. */
  'tooManyScopes',

  /** A position that is not a non-negative integer, or a key that is not a scope. */
  'invalidCursor',

  /** More rows than {@link SYNC_MAX_PUSH_CHANGES}, or a body over the ceiling. */
  'batchTooLarge',
] as const

export type SyncRequestErrorCode = (typeof SyncRequestErrorCodes)[number]

export const isSyncRequestErrorCode = (value: string): value is SyncRequestErrorCode =>
  (SyncRequestErrorCodes as readonly string[]).includes(value)

/** A `400` from a sync endpoint, carrying the machine-readable code. */
export interface SyncErrorResponse extends ErrorResponse {
  code: SyncRequestErrorCode
}
