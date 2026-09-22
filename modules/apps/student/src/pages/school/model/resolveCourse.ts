import type { LocalCourse, LocalSchool } from '@vidya/client'

/**
 * The course, when it is one this school teaches.
 *
 * The address names a school and a course independently, so a course of
 * another school can be pasted under this one's code. Answering with it would
 * draw that course inside a school that does not teach it, and the address
 * would then be two different claims about the same page.
 */
export const resolveCourse = (
  course: LocalCourse | null,
  school: LocalSchool | null,
): LocalCourse | null =>
  course !== null && school !== null && course.schoolId === school.id ? course : null
