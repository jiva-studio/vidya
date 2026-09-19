import {
  isSyncCollection,
  parseHlc,
  type SyncCollection,
  type SyncOp,
  SyncOps,
  type SyncPayload,
  SyncScopeKinds,
  type SyncScopeRef,
} from '@vidya/domain'
import { SYNC_MAX_CHANGE_BYTES, type SyncChange } from '@vidya/protocol'

/**
 * Deciding whether one incoming row can be stored, before anything is written.
 *
 * Everything checked here arrives from the server and none of it may take the
 * device down. The rule throughout is the same: **skip the row, advance the
 * position, record the fact**. A skipped row has been handled, not lost —
 * stalling the scope position on it would replay the same page forever, and
 * refusing the whole page would let one malformed row hold up every good one
 * beside it.
 *
 * Unknown fields inside `data` are deliberately not checked: a newer server may
 * send a column this build has never heard of, and the projection drops it on
 * the way into the table. Dropping a field is a smaller loss than dropping a
 * lesson.
 *
 * Pure: no IO, no clock. The one piece of knowledge it cannot hold itself —
 * which fields a collection cannot do without — is injected, because that
 * belongs to the device's table projection and this package must not import
 * the device.
 */

export const SyncSkipReasons = [
  /** A collection this build does not replicate. */
  'unknownCollection',

  /** `docId` is not an identifier. */
  'invalidDocId',

  /** `hlc` does not parse. */
  'invalidHlc',

  /** `serverSeq` is not a positive integer. */
  'invalidSeq',

  /** `scope` is absent or names a kind we do not know. */
  'invalidScope',

  /** `op` is neither `upsert` nor `delete`. */
  'invalidOp',

  /** An `upsert` whose `data` is `null`. */
  'missingData',

  /** `data` lacks a field that addresses the row. */
  'missingField',

  /** `data` is over {@link SYNC_MAX_CHANGE_BYTES}. */
  'payloadTooLarge',
] as const

export type SyncSkipReason = (typeof SyncSkipReasons)[number]

/** One row the pull stepped over, kept so the run can report what it saw. */
export interface SkippedChange {
  readonly serverSeq: number
  readonly collection: string
  readonly docId: string
  readonly reason: SyncSkipReason

  /** Free text for a log; the interface shows the reason, never this. */
  readonly detail?: string
}

/** A row that passed every check, with its untrusted parts now named. */
export interface ValidChange {
  readonly serverSeq: number
  readonly collection: SyncCollection
  readonly docId: string
  readonly op: SyncOp
  readonly data: SyncPayload | null
  readonly hlc: string
  readonly scope: SyncScopeRef

  /**
   * The school the row belongs to, off the envelope rather than the document.
   *
   * One local database holds several schools, so every stored row needs one —
   * but only some documents repeat it in their body. A lesson version, for
   * instance, has no school of its own: its school is a fact about where the
   * row sits, which is exactly what the envelope states.
   */
  readonly schoolId: string
}

/**
 * A string discriminant rather than a boolean one: `strictNullChecks` is off in
 * this workspace, and a `true | false` tag does not narrow reliably without it.
 */
export type ChangeVerdict =
  | { readonly verdict: 'storable'; readonly change: ValidChange }
  | { readonly verdict: 'skip'; readonly reason: SyncSkipReason; readonly detail?: string }

/**
 * Which fields a collection cannot be stored without.
 *
 * Injected. The answer lives in the device's projection table, and the device
 * is below this package, not beside it. A composition that supplies nothing
 * gets {@link NO_REQUIRED_FIELDS}, which checks only what the wire itself
 * guarantees.
 */
export type RequiredFields = (collection: SyncCollection) => readonly string[]

export const NO_REQUIRED_FIELDS: RequiredFields = () => []

/** Any UUID, any version — every identifier in this system is one. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const skip = (reason: SyncSkipReason, detail?: string): ChangeVerdict => ({
  verdict: 'skip',
  reason,
  detail,
})

/**
 * Check one incoming row.
 *
 * The order of the checks is the order in which a failure is cheapest to
 * describe, not an accident: a row naming an unknown collection has no fields
 * worth naming, and a row whose `hlc` does not parse cannot be compared to
 * anything at all. The size check sits where it does for a different reason —
 * it has to see the body the *server* measured, so it runs before the
 * envelope's school is folded in and before the required fields are counted.
 */
export function validateChange(change: SyncChange, required: RequiredFields): ChangeVerdict {
  const structural = checkStructure(change)
  if (structural !== null) return structural

  const collection = change.collection as SyncCollection
  if (change.op === 'delete') return accept(change, collection, null)

  const body = change.data
  if (body === null || body === undefined) return skip('missingData')

  // Measured on the body as it came off the wire, before anything of ours is
  // added to it. The ceiling is the server's, the server counts the body it
  // sent, and a row it let through has to be storable here — a lesson version
  // carries no school in its payload at all, so folding the envelope's school
  // in first would measure a row fifty bytes longer than the one that was
  // checked. A row on the boundary would then be skipped while its position
  // moved on past it, and the lesson would be missing for good.
  const oversized = checkSize(body)
  if (oversized !== null) return oversized

  // The school comes off the envelope, not the document. Homework and enrolments
  // repeat it in their body, content does not — a lesson version has no school
  // of its own, and one local database holds several. Folding it in here, ahead
  // of the required-field check, makes every collection behave the same way and
  // keeps the device from filing a row under no school at all.
  const data: SyncPayload = { ...body, schoolId: change.schoolId }

  const missing = required(collection).filter(
    (field) => data[field] === undefined || data[field] === null,
  )
  if (missing.length > 0) return skip('missingField', missing.join(', '))

  return accept(change, collection, data)
}

/** The parts every row must have, whatever collection it belongs to. */
function checkStructure(change: SyncChange): ChangeVerdict | null {
  if (typeof change.collection !== 'string' || !isSyncCollection(change.collection)) {
    return skip('unknownCollection', String(change.collection))
  }
  if (typeof change.docId !== 'string' || !UUID.test(change.docId)) {
    return skip('invalidDocId', String(change.docId))
  }
  if (!(SyncOps as readonly string[]).includes(change.op))
    return skip('invalidOp', String(change.op))
  if (!isPositiveInteger(change.serverSeq)) return skip('invalidSeq', String(change.serverSeq))
  if (!isKnownScope(change.scope)) return skip('invalidScope')
  if (!parsesAsHlc(change.hlc)) return skip('invalidHlc', String(change.hlc))

  return null
}

/**
 * The ceiling on one row.
 *
 * Measured in UTF-8 bytes, which is what the wire carries and what the server
 * counts — a text of emoji and RTL marks is several times its length in
 * characters, and counting characters would let a row through here that the
 * server already refused.
 *
 * Measured on the payload the server sent and on nothing else. The two sides
 * have to count the same bytes, or the boundary is in two places at once and
 * whatever falls between them is content the device silently never stores.
 */
function checkSize(data: SyncPayload): ChangeVerdict | null {
  const bytes = utf8Length(JSON.stringify(data))
  if (bytes <= SYNC_MAX_CHANGE_BYTES) return null

  return skip('payloadTooLarge', `${bytes} bytes`)
}

function accept(
  change: SyncChange,
  collection: SyncCollection,
  data: SyncPayload | null,
): ChangeVerdict {
  return {
    verdict: 'storable',
    change: {
      serverSeq: change.serverSeq,
      collection,
      docId: change.docId,
      op: change.op,
      data,
      hlc: change.hlc,
      scope: change.scope,
      schoolId: change.schoolId,
    },
  }
}

function parsesAsHlc(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    parseHlc(value)
    return true
  } catch {
    // The row is the server's, not ours to repair. Naming it invalid here is
    // the whole point; rethrowing would take the page down with it.
    return false
  }
}

function isKnownScope(scope: unknown): scope is SyncScopeRef {
  if (scope === null || typeof scope !== 'object') return false
  const candidate = scope as { kind?: unknown; id?: unknown }
  return (
    typeof candidate.kind === 'string' &&
    (SyncScopeKinds as readonly string[]).includes(candidate.kind) &&
    typeof candidate.id === 'string' &&
    candidate.id !== ''
  )
}

const isPositiveInteger = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

/** Byte length of a string once encoded as UTF-8, without allocating a buffer. */
export function utf8Length(value: string): number {
  let bytes = 0
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code < 0x10000) bytes += 3
    else bytes += 4
  }

  return bytes
}
