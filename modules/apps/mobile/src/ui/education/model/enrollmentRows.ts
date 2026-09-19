import type { LocalCourse, LocalEnrollment } from '@/ports'

import type { EnrollmentViewModel } from '../components/Enrollments'

/**
 * Join the student's places to the courses the device holds.
 *
 * Scope positions advance independently, so an enrolment can be here before
 * its course. The row is listed either way — it is the student's place, and a
 * missing name is not a reason to hide it.
 */
export function toEnrollmentRows(
  enrollments: readonly LocalEnrollment[],
  courses: readonly LocalCourse[],
): EnrollmentViewModel[] {
  const byId = new Map(courses.map((course) => [course.id, course]))

  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    courseName: byId.get(enrollment.courseId)?.name ?? '',
    status: enrollment.status,
  }))
}
