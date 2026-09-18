import * as domain from '@vidya/domain'
import { Course, Enrollment, LessonVersion } from '@vidya/entities'
import { PushChange } from '@vidya/protocol'
import { EntityManager } from 'typeorm'

/** Why one row was refused. A value, not an exception: its neighbours still apply. */
export interface Rejection {
  reason: domain.SyncRejectionReason
  detail: string
}

export const reject = (reason: domain.SyncRejectionReason, detail: string): Rejection => ({
  reason,
  detail,
})

export const isRejection = (value: unknown): value is Rejection =>
  typeof value === 'object' && value !== null && 'reason' in value

/** The place on the course, and the content, a pushed row is written against. */
export interface RowAccess {
  enrollment: Enrollment
  version: LessonVersion
}

/**
 * A row that passed every check, ready to be written.
 *
 * `body` is only the fields the client owns; whatever else arrived has already
 * been dropped, silently. It doubles as what a repeated push is compared
 * against, which is why it is kept rather than applied straight away.
 *
 * What the row was checked *against* differs by collection, so both references
 * are optional and each applier fills the one it resolved. Work done inside a
 * lesson carries `access` — the place on the course and the version answered.
 * A request for a place carries `course` instead: there is no enrolment to
 * resolve it against, because the row is the enrolment.
 */
export interface PreparedRow {
  access?: RowAccess
  course?: Course
  body: domain.SyncPayload
}

/** The caller and the moment, carried to every applier that needs them. */
export interface PushRowContext {
  userId: domain.UserId

  /** Unix milliseconds from the clock port; the appliers stamp times with it. */
  now: number
}

/**
 * How one collection receives a pushed row.
 *
 * One object per writable collection rather than a switch, so that adding a
 * collection is adding a file and forgetting to add one is a `readOnlyCollection`
 * refusal rather than a row written with nobody's rules applied.
 */
export interface PushApplier {
  collection: domain.SyncCollection

  /** Resolves the row against the caller's rights and the collection's contract. */
  prepare(
    manager: EntityManager,
    change: PushChange,
    context: PushRowContext,
  ): Promise<PreparedRow | Rejection>

  /** Whether the stored row may still be written by its student. */
  editable(manager: EntityManager, change: PushChange): Promise<Rejection | null>

  /**
   * Writes the row through the ORM, so the journal subscriber sees it, and
   * answers with the id it wrote under.
   *
   * That id is not always `change.docId`. A collection with a natural key
   * writes onto the row the key already holds, whatever the device chose to
   * call it, and the answer has to say so or the device is left holding a row
   * the server never stored.
   */
  apply(
    manager: EntityManager,
    change: PushChange,
    prepared: PreparedRow,
    context: PushRowContext,
  ): Promise<string>
}

/** A field the client sent that this collection lets it write, and nothing else. */
export const ownedBy = (
  collection: domain.SyncCollection,
  data: domain.SyncPayload,
): domain.SyncPayload => {
  const owned = domain.clientOwnedFields(collection)

  if (domain.ownsEveryField(owned)) return { ...data }

  return Object.fromEntries(
    Object.entries(data).filter(([field]) => owned.includes(field)),
  ) as domain.SyncPayload
}
