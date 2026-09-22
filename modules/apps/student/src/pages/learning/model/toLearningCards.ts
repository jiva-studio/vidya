import type { LocalCourse, LocalEnrollment, LocalSchool } from '@vidya/client'

import type { LearningCard } from '../types'

/**
 * Join the student's places to the courses and schools this machine holds.
 *
 * Every place is listed, including one whose course has not arrived: the row
 * is the student's own and the only thing missing is a name. Dropping it would
 * make a place vanish from the one screen that exists to show them.
 */
export const toLearningCards = (
  enrollments: readonly LocalEnrollment[],
  courses: readonly LocalCourse[],
  schools: readonly LocalSchool[],
): LearningCard[] => {
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const schoolById = new Map(schools.map((school) => [school.id, school]))

  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    courseId: enrollment.courseId,
    courseName: courseById.get(enrollment.courseId)?.name ?? null,
    schoolName: schoolById.get(enrollment.schoolId)?.name ?? null,
    schoolCode: schoolById.get(enrollment.schoolId)?.code ?? null,
    status: enrollment.status,
  }))
}
