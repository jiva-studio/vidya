import type * as domain from '@vidya/domain'

import type { CourseDetails } from './courses'
import type { EnrollmentDetails } from './enrollments'
import type { BlockStateDetails, HomeworkDetails } from './homework'
import type { LessonDetails, LessonVersionDetails } from './lessons'

/**
 * The fields each collection carries in a sync payload.
 *
 * There are two projection tables, and they cannot be merged because they do
 * different things: the server's turns a TypeORM entity into the JSON that goes
 * on the wire, the device's turns that JSON into SQLite columns. What they
 * share is this list, and until it was written down nothing checked it.
 * reconciled the server with itself, reconciled the device with itself,
 * and between them was the contract — unchecked by a type and unchecked by a
 * test. The two drifted three times, and not one drift produced an error:
 *
 * - `lesson_versions`: the device required a `schoolId` the server did not
 *   send, so every version was skipped **while its scope cursor advanced**, and
 *   a second pull would not have brought it back.
 * - `homework`: the device kept `created_at`/`updated_at` the server did not
 *   send, so both were stored as empty strings and the answer list came back in
 *   an order nothing justified.
 * - `enrollments`, `lesson_versions`: `deletedAt` is never projected, which is
 *   correct — but correct by agreement, with nothing saying so.
 *
 * This file is that agreement. Both sides are checked against it by, one
 * in `@vidya/api`, one in `@vidya/mobile` — two halves rather than one test
 * because a lib may not import an app and a service may not either, and a third
 * copy of the field list is exactly the thing being prevented. Comparing both
 * sides to the same list is comparing them to each other.
 *
 * The lists are typed `keyof`, so renaming a field in the protocol breaks
 * compilation here rather than quietly widening what may be sent, and the
 * fixtures under `__fixtures__/sync/` are checked against the same lists.
 *
 * **Two fields are legitimately stored by a device without ever being sent**,
 * and they are structural rather than per-collection:
 *
 * - `schoolId`, when a document does not repeat it. The envelope always names
 *   the school, and `validateChange` folds it into the payload before anything
 *   else looks at it: one local database holds several schools, so every stored
 *   row needs one, but a lesson version has no school of its own to send.
 * - a tombstone column, which the `delete` op writes. Nothing carries it in a
 *   body, because a body is what an `upsert` has.
 *
 * Anything else the device names and the server never sends arrives as a
 * fallback — which for a time is an empty string, and an empty string sorts
 * before every real instant.
 */
export const SYNC_WIRE_FIELDS: Readonly<Record<domain.SyncCollection, readonly string[]>> =
  Object.freeze({
    courses: [
      'id',
      'schoolId',
      'name',
      'description',
      'learningType',
    ] satisfies readonly (keyof CourseDetails)[],

    lessons: ['id', 'courseId', 'lessonNumber', 'title'] satisfies readonly (keyof LessonDetails)[],

    lesson_versions: [
      'id',
      'lessonId',
      'version',
      'status',
      'content',
      'publishedAt',
    ] satisfies readonly (keyof LessonVersionDetails)[],

    enrollments: [
      'id',
      'courseId',
      'groupId',
      'studentId',
      'schoolId',
      'status',
      'decidedById',
      'decidedAt',
      'createdAt',
    ] satisfies readonly (keyof EnrollmentDetails)[],

    homework: [
      'id',
      'enrollmentId',
      'lessonVersionId',
      'sectionId',
      'schoolId',
      'status',
      'text',
      'grade',
      'answeredSupersededVersion',
      'reviewedById',
      'submittedAt',
      'reviewedAt',
      'createdAt',
    ] satisfies readonly (keyof HomeworkDetails)[],

    block_states: [
      'id',
      'enrollmentId',
      'lessonVersionId',
      'blockId',
      'schoolId',
      'state',
      'updatedAt',
    ] satisfies readonly (keyof BlockStateDetails)[],
  })

/**
 * The field a device may hold without the wire ever carrying it, besides its
 * tombstone column: the school, which comes off the envelope.
 */
export const SYNC_ENVELOPE_FIELD = 'schoolId'

/** What one side has that the other does not, in both directions. */
export interface FieldDifference {
  readonly unexpected: readonly string[]
  readonly missing: readonly string[]
}

/**
 * Compares a set of field names against the contract for `collection`.
 *
 * `unexpected` is what the side has and the contract does not; `missing` is the
 * other way round. `allowed` names the fields this side may hold without them
 * being on the wire — a device passes its tombstone column and the envelope's
 * school, a server passes nothing.
 */
export const diffAgainstWire = (
  collection: domain.SyncCollection,
  fields: readonly string[],
  allowed: readonly string[] = [],
): FieldDifference => {
  const contract = new Set(SYNC_WIRE_FIELDS[collection])
  const tolerated = new Set(allowed)
  const held = new Set(fields)

  return {
    unexpected: [...held].filter((field) => !contract.has(field) && !tolerated.has(field)).sort(),
    missing: [...contract].filter((field) => !held.has(field)).sort(),
  }
}
