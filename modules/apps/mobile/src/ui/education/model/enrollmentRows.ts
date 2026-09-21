import type { LocalCourse, LocalEnrollment, LocalGroup } from '@vidya/client'

import type { EnrollmentViewModel } from '../components/Enrollments'

/**
 * Join the student's places to the courses and groups the device holds.
 *
 * Scope positions advance independently, so an enrolment can be here before
 * its course or its group. The row is listed either way — it is the student's
 * place, and a missing name is not a reason to hide it.
 */
export function toEnrollmentRows(
  enrollments: readonly LocalEnrollment[],
  courses: readonly LocalCourse[],
  groups: readonly LocalGroup[] = [],
): EnrollmentViewModel[] {
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const groupById = new Map(groups.map((group) => [String(group.id), group]))

  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    courseName: courseById.get(enrollment.courseId)?.name ?? '',
    groupName: enrollment.groupId ? groupById.get(enrollment.groupId)?.name : undefined,
    status: enrollment.status,
    requestedAt: enrollment.createdAt,
  }))
}
