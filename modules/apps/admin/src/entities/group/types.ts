import type { CourseId, EnrollmentStatus, IsoDateTime, UserId } from '@vidya/domain'

/**
 * What the group form holds and sends.
 *
 * Name, course and description — the whole of `GroupDetails`. The archive's
 * group also had a start date and a teacher; neither exists in our schema.
 */
export interface GroupFormValues {
  name: string
  courseId: string
  description: string
}

/**
 * One student in a group.
 *
 * The group's roster is its accepted enrolments: the group itself holds no
 * list of people. The name is resolved separately because an enrolment carries
 * a student id and nothing else.
 */
export type GroupMember = {
  enrollmentId: string
  studentId?: UserId

  /** The course the place is on: what the "move to another group" dialog needs. */
  courseId: CourseId

  name?: string
  status: EnrollmentStatus
  enrolledAt: IsoDateTime
}

/** A course as the group form and the list filter offer it. */
export interface GroupCourseOption {
  id: CourseId
  name: string
}
