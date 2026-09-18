import { asId, EnrollmentId, SchoolId } from '@vidya/domain'
import {
  BlockState,
  Course,
  Enrollment,
  Homework,
  Lesson,
  LessonVersion,
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
 * trailing `Z` — UTC, never a local offset (Д-17). A timezone must not be able
 * to change the order two devices agree on, or the day a deadline falls on.
 */
export interface CollectionProjection<TEntity> {
  collection: string
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

const courses: CollectionProjection<Course> = {
  collection: 'courses',
  scopeKind: 'course',
  target: async (course) => ({ scopeId: course.id, schoolId: course.schoolId }),
  project: (course) => ({
    id: course.id,
    schoolId: course.schoolId,
    name: course.name,
    description: course.description ?? null,
    learningType: course.learningType,
  }),
}

const lessons: CollectionProjection<Lesson> = {
  collection: 'lessons',
  scopeKind: 'course',
  target: async (lesson) => ({ scopeId: lesson.courseId, schoolId: lesson.schoolId }),
  project: (lesson) => ({
    id: lesson.id,
    courseId: lesson.courseId,
    schoolId: lesson.schoolId,
    lessonNumber: lesson.lessonNumber,
    title: lesson.title,
  }),
}

/**
 * A version reaches devices only once it is published (T-S-4, T-S-5).
 *
 * A draft is an editor's scratch space: journalling it would put unfinished
 * content on students' devices and would make publishing the *second* journal
 * event for the same document rather than the first.
 *
 * The scope comes from the lesson, which is what carries the course — a version
 * knows only its lesson.
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
    content: version.content,
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
 * silently, which is why `T-S-7` reconciles the keys against `SYNCED_ENTITIES`.
 */
export const COLLECTION_PROJECTIONS: Record<string, CollectionProjection<any>> = {
  Course: courses,
  Lesson: lessons,
  LessonVersion: lessonVersions,
  Enrollment: enrollments,
  Homework: homework,
  BlockState: blockStates,
}

export const projectionFor = (entityName: string): CollectionProjection<any> | undefined =>
  COLLECTION_PROJECTIONS[entityName]
