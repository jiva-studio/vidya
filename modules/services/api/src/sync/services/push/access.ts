import * as domain from '@vidya/domain'
import { Enrollment, Lesson, LessonVersion } from '@vidya/entities'
import { EntityManager } from 'typeorm'

import { reject, Rejection, RowAccess } from './types'

/** What a row has to name before it can be checked at all. */
export interface RowRefs {
  enrollmentId: domain.EnrollmentId
  lessonVersionId: domain.LessonVersionId
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)

/**
 * The identity a new document arrives with.
 *
 * Identity fields are not owned by either side: they are written once, when the
 * row is created, and never merged afterwards. A row the server already holds
 * therefore takes its identity from what is stored and ignores whatever the
 * client repeated; only a row that does not exist yet has to say who it is.
 */
export const refsFrom = (data: domain.SyncPayload | null): RowRefs | Rejection => {
  if (!data || !isUuid(data.enrollmentId) || !isUuid(data.lessonVersionId)) {
    return reject('malformed', 'a new row must name its enrolment and its lesson version')
  }

  return {
    enrollmentId: domain.asId<domain.EnrollmentId>(data.enrollmentId),
    lessonVersionId: domain.asId<domain.LessonVersionId>(data.lessonVersionId),
  }
}

/**
 * Whether this caller may write this row, in the order the contract fixes.
 *
 * **The version check asks whether the version exists and was published, not
 * whether it is the one published now.** A student can answer offline
 * against version 3 while version 4 is being published, and refusing that would
 * break the single case offline mode exists for. Publishing does not unpublish
 * what came before, so version 3 stays a legitimate target; the answer is
 * *flagged* as written against a superseded text, and the reviewer sees which
 * text it was.
 */
export const resolveAccess = async (
  manager: EntityManager,
  refs: RowRefs,
  userId: domain.UserId,
): Promise<RowAccess | Rejection> => {
  const enrollment = await manager.findOneBy(Enrollment, { id: refs.enrollmentId })

  if (!enrollment || enrollment.studentId !== userId) {
    return reject('notYourEnrollment', 'the row is addressed to another student enrolment')
  }

  if (enrollment.status !== 'accepted') {
    return reject('enrollmentRevoked', 'the enrolment no longer grants access')
  }

  return versionOf(manager, refs, enrollment)
}

const versionOf = async (
  manager: EntityManager,
  refs: RowRefs,
  enrollment: Enrollment,
): Promise<RowAccess | Rejection> => {
  const version = await manager.findOneBy(LessonVersion, { id: refs.lessonVersionId })

  if (!version || version.status !== 'published') {
    return reject('unknownLessonVersion', 'the answered lesson version was never published')
  }

  const lesson = await manager.findOneBy(Lesson, { id: version.lessonId })

  // A version of another course is not a version this place on a course reaches.
  if (!lesson || lesson.courseId !== enrollment.courseId) {
    return reject('unknownLessonVersion', 'the version does not belong to the enrolled course')
  }

  return { enrollment, version }
}

/**
 * Whether the answered version had already been superseded when it was written.
 *
 * Read through the caller's transaction, so that a version published in a
 * neighbouring row of the same batch is seen.
 */
export const isSuperseded = async (
  manager: EntityManager,
  version: LessonVersion,
): Promise<boolean> => {
  const published = await manager.findBy(LessonVersion, {
    lessonId: version.lessonId,
    status: 'published',
  })

  const latest = published.sort((a, b) => b.version - a.version)[0]

  return Boolean(latest) && latest.id !== version.id
}
