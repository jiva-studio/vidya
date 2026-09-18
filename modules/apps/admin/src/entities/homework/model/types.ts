import type { CourseId, EnrollmentId, GroupId, HomeworkStatus, UserId } from '@vidya/domain'
import type { HomeworkSummary } from '@vidya/protocol'

/**
 * Who a piece of work belongs to.
 *
 * `HomeworkSummary` names an enrolment and nothing else — no student, no course
 * and no group — so all three are resolved through that enrolment and handed
 * in from outside. The entity takes the shape rather than the slice, which is
 * what keeps it from reaching sideways into another entity.
 */
export type WorkContext = {
  studentId?: UserId
  studentName?: string
  courseId?: CourseId
  groupId?: GroupId
  courseName?: string
  groupName?: string
}

export type ContextLookup = (enrollmentId: EnrollmentId) => WorkContext | undefined

/** One line of the queue. */
export type HomeworkRow = HomeworkSummary & WorkContext

/** What the controls above the queue narrow it by. */
export interface HomeworkFilters {
  status?: HomeworkStatus
  courseId?: CourseId
  groupId?: GroupId
}
