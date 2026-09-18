/**
 * Shared sync vocabulary: the collections that replicate, the shape of one
 * replicated document, and the scopes a change is addressed to.
 *
 * Modelled on Lectorium's `libs/domain/sync/types.ts`, with our six collections
 * in place of its playlists and notes, and with scopes added — our read
 * position is per scope, not one number for the whole journal.
 *
 * Pure: no IO, no transport. The wire shapes in `@vidya/protocol` are built on
 * top of these, so a collection name cannot mean one thing to the server and
 * another to the device.
 */

/**
 * The replicating collections. The name is the server table and the local
 * SQLite table, so a row never has to be translated between two vocabularies.
 * A collection absent from this list does not sync at all.
 */
export const SyncCollections = [
  'courses',
  'lessons',
  'lesson_versions',
  'enrollments',
  'homework',
  'block_states',
] as const

export type SyncCollection = (typeof SyncCollections)[number]

export const isSyncCollection = (value: string): value is SyncCollection =>
  (SyncCollections as readonly string[]).includes(value)

/** A change as journaled in the outbox and replicated over the wire. */
export const SyncOps = ['upsert', 'delete'] as const
export type SyncOp = (typeof SyncOps)[number]

/**
 * A replicated payload as the engine sees it: a bag of named fields.
 *
 * It stays a bag on purpose. Field ownership (`direction.ts`) is what the merge
 * reasons about, and it is expressed in field names; a collection-specific type
 * here would force the merge to know six shapes to answer one question.
 */
export type SyncPayload = Record<string, unknown>

/** Address of one synced document — the collection plus its natural key. */
export interface SyncDocRef {
  readonly collection: SyncCollection
  readonly docId: string
}

/**
 * One document version as the merge layer sees it: the natural key, the HLC
 * stamped on the write, and the payload (`null` when the version is a
 * tombstone). `T` is the collection-specific payload shape.
 */
export interface SyncDoc<T extends SyncPayload = SyncPayload> {
  readonly docId: string

  /** HLC stamped on this version — the conflict tiebreak. */
  readonly hlc: string

  /** `true` when this version is a delete tombstone (`op = 'delete'`). */
  readonly deleted: boolean

  /** Payload; `null` iff {@link deleted}. */
  readonly data: T | null
}

/* -------------------------------------------------------------------------- */
/*                                   Scopes                                   */
/* -------------------------------------------------------------------------- */

/**
 * Who a journal row is addressed to. The addressee is stamped when the row is
 * written, so a pull is one indexed read and never a permission join.
 */
export const SyncScopeKinds = ['school', 'course', 'user'] as const
export type SyncScopeKind = (typeof SyncScopeKinds)[number]

export interface SyncScopeRef {
  readonly kind: SyncScopeKind
  readonly id: string
}

/**
 * A scope rendered as one string, `<kind>:<id>` — the key of the cursor and
 * checksum maps on the wire, where an object key has to be a string anyway.
 */
export type SyncScopeKey = `${SyncScopeKind}:${string}`

export const syncScopeKey = (scope: SyncScopeRef): SyncScopeKey => `${scope.kind}:${scope.id}`

/** Parse a `<kind>:<id>` key, throwing on anything that is not one. */
export const parseSyncScopeKey = (key: string): SyncScopeRef => {
  const separator = key.indexOf(':')
  const kind = key.slice(0, separator)
  const id = key.slice(separator + 1)
  if (separator === -1 || !(SyncScopeKinds as readonly string[]).includes(kind) || id === '') {
    throw new Error(`Invalid sync scope key: ${key}`)
  }

  return { kind: kind as SyncScopeKind, id }
}

/* -------------------------------------------------------------------------- */
/*                         Fields of the two-way rows                         */
/* -------------------------------------------------------------------------- */

/**
 * The mutable fields of a two-way collection, named once so the ownership table
 * in `direction.ts` can be checked for completeness rather than trusted. Keys
 * that identify the row (`id`, `enrollmentId`, `schoolId`, …) are not listed:
 * they are written once and never merged.
 */
export const HomeworkSyncFields = [
  'text',
  'submittedAt',
  'status',
  'grade',
  'reviewedById',
  'reviewedAt',
  'answeredSupersededVersion',
] as const

export type HomeworkSyncField = (typeof HomeworkSyncFields)[number]

export const EnrollmentSyncFields = ['status', 'decidedById', 'decidedAt', 'groupId'] as const

export type EnrollmentSyncField = (typeof EnrollmentSyncFields)[number]

/* -------------------------------------------------------------------------- */
/*                              Rejection reasons                             */
/* -------------------------------------------------------------------------- */

/**
 * Why the server refused one pushed row.
 *
 * These live in the domain rather than in `@vidya/protocol` for the same reason
 * lesson content does: a reason is not only a wire value. The device stores it
 * on the outbox row it belongs to and shows it on the answer itself, so the
 * device's own code has to name the same set the server does.
 * `@vidya/protocol` re-exports them, so clients still read them from there.
 *
 * A refusal is a per-row state, never a failure of the batch: one rejected
 * answer must not hold up the video progress travelling beside it.
 */
export const SyncRejectionReasons = [
  /** The collection replicates downward only — the client may not write it. */
  'readOnlyCollection',

  /** The row is addressed to an enrolment that is not the caller's. */
  'notYourEnrollment',

  /** The enrolment exists but no longer grants access (withdrawn or declined). */
  'enrollmentRevoked',

  /** The answered lesson version is unknown or was never published. */
  'unknownLessonVersion',

  /** The work has already been accepted, so its text is frozen for good. */
  'alreadyAccepted',

  /** The row, or the batch carrying it, is over the size ceiling. */
  'payloadTooLarge',

  /** The body does not satisfy the contract for its collection. */
  'malformed',
] as const

export type SyncRejectionReason = (typeof SyncRejectionReasons)[number]

export const isSyncRejectionReason = (value: string): value is SyncRejectionReason =>
  (SyncRejectionReasons as readonly string[]).includes(value)
