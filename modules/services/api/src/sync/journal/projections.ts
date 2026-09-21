import { toStudentContent } from '@vidya/api/edu/mappers/studentContent'
import { asId, EnrollmentId, SchoolId, SyncCollection } from '@vidya/domain'
import {
  BlockState,
  Course,
  Enrollment,
  Group,
  Homework,
  Lesson,
  LessonVersion,
  School,
  SyncScopeKind,
} from '@vidya/entities'
import { EntityManager } from 'typeorm'

/** Where a journal row is delivered, and which tenant it belongs to. */
export interface JournalTarget {
  scopeId: string
  schoolId: SchoolId
}

/**
 * How one entity becomes a journal row.
 *
 * Everything the journal needs to know about an entity is here and only here:
 * its collection name on the wire, the kind of scope it is addressed to, how to
 * find the scope, whether a given row may be journalled at all, and what of it
 * goes over the wire.
 *
 * Instants are projected as `Date`, which JSON serialises as ISO-8601 with a
 * trailing `Z` — UTC, never a local offset. A timezone must not be able to
 * change the order two devices agree on, or the day a deadline falls on.
 */
export interface CollectionProjection<TEntity> {
  /**
   * The name this entity travels under.
   *
   * Typed, not `string`: a typo here is not a compile error waiting to happen,
   * it is a silent loss. The server would journal `lesson_version`, the device
   * would drop the row as a collection it does not know, and the scope cursor
   * would move past it — the row is gone and nothing anywhere reports it.
   */
  collection: SyncCollection
  scopeKind: SyncScopeKind
  /** `false` keeps the row out of the journal entirely. Drafts never leave. */
  journals?: (entity: TEntity) => boolean
  target: (entity: TEntity, manager: EntityManager) => Promise<JournalTarget>
  project: (entity: TEntity) => Record<string, unknown>
}

const enrollmentTarget = async (
  entity: { enrollmentId: string; schoolId: SchoolId },
  manager: EntityManager,
): Promise<JournalTarget> => {
  const enrollment = await manager
    .getRepository(Enrollment)
    .findOneBy({ id: asId<EnrollmentId>(entity.enrollmentId) })

  if (!enrollment) {
    throw new Error(`sync journal: enrollment ${entity.enrollmentId} not found`)
  }

  return { scopeId: enrollment.studentId, schoolId: entity.schoolId }
}

/** The school's own row: what a device draws a school by before any course of it. */
const schools: CollectionProjection<School> = {
  collection: 'schools',
  scopeKind: 'school',
  target: async (school) => ({ scopeId: school.id, schoolId: school.id }),
  project: (school) => ({
    id: school.id,
    name: school.name,
    logoUrl: school.logoUrl ?? null,
    description: school.description ?? null,
  }),
}

/**
 * A course is addressed to its school, not to itself.
 *
 * The catalogue is what a member of the school may read without holding a place
 * on anything, and the course scope carries only what an enrolled student gets.
 * Journalling the card to both would give one document two versions racing on
 * their clocks, and the card would flicker between them.
 */
const courses: CollectionProjection<Course> = {
  collection: 'courses',
  scopeKind: 'school',
  target: async (course) => ({ scopeId: course.schoolId, schoolId: course.schoolId }),
  project: (course) => ({
    id: course.id,
    schoolId: course.schoolId,
    name: course.name,
    description: course.description ?? null,
    learningType: course.learningType,
  }),
}

/**
 * The catalogue of places on a course, addressed to the school.
 *
 * The school rather than the course, because the reader is precisely someone
 * who holds no place yet and therefore no course scope. The price — a group's
 * name and start date visible to every member of the school — is the same one
 * already paid for the course card.
 *
 * Every status is journalled, closed groups included. Journalling only the
 * recruiting ones would make `pending -> active` produce no row at all, and the
 * group would stay in a device's catalogue for ever; the device filters.
 */
const groups: CollectionProjection<Group> = {
  collection: 'groups',
  scopeKind: 'school',
  target: async (group) => ({ scopeId: group.schoolId, schoolId: group.schoolId }),
  project: (group) => ({
    id: group.id,
    courseId: group.courseId,
    name: group.name,
    description: group.description ?? null,
    startsAt: group.startsAt ?? null,
    status: group.status,
  }),
}

const lessons: CollectionProjection<Lesson> = {
  collection: 'lessons',
  scopeKind: 'course',
  target: async (lesson) => ({ scopeId: lesson.courseId, schoolId: lesson.schoolId }),
  // No `schoolId`: a lesson's school is a fact about where the row sits, which
  // is what the envelope states and what the device files it under. Repeating
  // it in the body would put it on the wire without `LessonDetails` having it.
  project: (lesson) => ({
    id: lesson.id,
    courseId: lesson.courseId,
    lessonNumber: lesson.lessonNumber,
    title: lesson.title,
  }),
}

/**
 * A version reaches devices only once it is published.
 *
 * A draft is an editor's scratch space: journalling it would put unfinished
 * content on students' devices and would make publishing the *second* journal
 * event for the same document rather than the first.
 *
 * The scope comes from the lesson, which is what carries the course — a version
 * knows only its lesson.
 *
 * The content is the student projection, never the raw document. The journal's
 * one reader is a student's device, and what reaches that device reaches a
 * SQLite file no later server change can recall, so a quiz key journalled once
 * is a quiz key given away for good. `toStudentContent` is the same function
 * the REST path uses, on purpose: two implementations of "what a student may be
 * handed" is one implementation and one hole. Staff are not a reason to loosen
 * it — a reviewer gets the key from `GET versions/:versionId`, behind a
 * permission check.
 */
const lessonVersions: CollectionProjection<LessonVersion> = {
  collection: 'lesson_versions',
  scopeKind: 'course',
  journals: (version) => version.status === 'published',
  target: async (version, manager) => {
    const lesson = await manager.getRepository(Lesson).findOneBy({ id: version.lessonId })

    if (!lesson) {
      throw new Error(`sync journal: lesson ${version.lessonId} not found`)
    }

    return { scopeId: lesson.courseId, schoolId: lesson.schoolId }
  },
  project: (version) => ({
    id: version.id,
    lessonId: version.lessonId,
    version: version.version,
    status: version.status,
    content: toStudentContent(version.content),
    publishedAt: version.publishedAt ?? null,
  }),
}

const enrollments: CollectionProjection<Enrollment> = {
  collection: 'enrollments',
  scopeKind: 'user',
  target: async (enrollment) => ({
    scopeId: enrollment.studentId,
    schoolId: enrollment.schoolId,
  }),
  project: (enrollment) => ({
    id: enrollment.id,
    courseId: enrollment.courseId,
    groupId: enrollment.groupId ?? null,
    studentId: enrollment.studentId,
    schoolId: enrollment.schoolId,
    status: enrollment.status,
    decidedById: enrollment.decidedById ?? null,
    decidedAt: enrollment.decidedAt ?? null,
    createdAt: enrollment.createdAt,
    preferredGroupId: enrollment.preferredGroupId ?? null,
    preferredTimes: enrollment.preferredTimes ?? null,
    comment: enrollment.comment ?? null,
    // Named even when empty: the merge reads an absent key as "the server has
    // nothing to say", so omitting it would make the stamp impossible to clear.
    archivedByStudentAt: enrollment.archivedByStudentAt ?? null,
  }),
}

const homework: CollectionProjection<Homework> = {
  collection: 'homework',
  scopeKind: 'user',
  target: enrollmentTarget,
  project: (item) => ({
    id: item.id,
    enrollmentId: item.enrollmentId,
    lessonVersionId: item.lessonVersionId,
    sectionId: item.sectionId,
    schoolId: item.schoolId,
    status: item.status,
    text: item.text,
    grade: item.grade ?? null,
    reviewedById: item.reviewedById ?? null,
    answeredSupersededVersion: item.answeredSupersededVersion,
    submittedAt: item.submittedAt ?? null,
    reviewedAt: item.reviewedAt ?? null,
    createdAt: item.createdAt,
  }),
}

const blockStates: CollectionProjection<BlockState> = {
  collection: 'block_states',
  scopeKind: 'user',
  target: enrollmentTarget,
  project: (state) => ({
    id: state.id,
    enrollmentId: state.enrollmentId,
    lessonVersionId: state.lessonVersionId,
    blockId: state.blockId,
    schoolId: state.schoolId,
    state: state.state,
    updatedAt: state.updatedAt ?? null,
  }),
}

/**
 * Entity name to projection. An entity absent from this table does not sync —
 * silently, which is why a test reconciles these keys against
 * `SYNCED_ENTITIES`.
 */
export const COLLECTION_PROJECTIONS: Record<string, CollectionProjection<any>> = {
  School: schools,
  Course: courses,
  Group: groups,
  Lesson: lessons,
  LessonVersion: lessonVersions,
  Enrollment: enrollments,
  Homework: homework,
  BlockState: blockStates,
}

export const projectionFor = (entityName: string): CollectionProjection<any> | undefined =>
  COLLECTION_PROJECTIONS[entityName]
