import type * as domain from '@vidya/domain'

import type { CourseDetails } from './courses'
import type { EnrollmentDetails } from './enrollments'
import type { GroupSyncDetails } from './groups'
import type { BlockStateDetails, HomeworkDetails } from './homework'
import type { LessonDetails, LessonVersionDetails } from './lessons'
import type { SchoolDetails } from './schools'

/**
 * The fields each collection carries in a sync payload.
 *
 * Two projection tables cannot be merged, because they do different things: the
 * server's turns a TypeORM entity into the JSON that goes on the wire, the
 * device's turns that JSON into SQLite columns. This list is the contract
 * between them. Each side is checked against it by a test of its own — a lib
 * may not import an app and a service may not either, and a third copy of the
 * field list is the thing being prevented — so comparing both sides to this
 * list compares them to each other. The lists are typed `keyof`, which makes
 * renaming a protocol field a compilation error here rather than a quiet
 * widening of what may be sent.
 *
 * Two fields a device stores without ever being sent are structural rather than
 * per-collection: `schoolId`, which the envelope names once and `validateChange`
 * folds into the payload, and the tombstone column the `delete` op writes.
 * Anything else the device names and the server never sends arrives as a
 * fallback value.
 */
export const SYNC_WIRE_FIELDS: Readonly<Record<domain.SyncCollection, readonly string[]>> =
  Object.freeze({
    // The row is its own school, so the envelope's `schoolId` restates `id`.
    schools: ['id', 'name', 'logoUrl', 'description'] satisfies readonly (keyof SchoolDetails)[],

    courses: [
      'id',
      'schoolId',
      'name',
      'description',
      'learningType',
      'status',
    ] satisfies readonly (keyof CourseDetails)[],

    // No `schoolId`: the envelope states it, and the group rides the school
    // scope because a student who has not enrolled holds no course scope.
    groups: [
      'id',
      'courseId',
      'name',
      'description',
      'startsAt',
      'status',
    ] satisfies readonly (keyof GroupSyncDetails)[],

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
      'preferredGroupId',
      'preferredTimes',
      'comment',
      // The school's own archiving stays off the wire; this one is the
      // student's, and a clean install has no local row to merge it onto.
      'archivedByStudentAt',
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
      'comment',
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
      'verdict',
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
