import type { LocalCourse, LocalSchool } from '@/ports'

import type { CourseCardViewModel } from '../components/Courses'

/**
 * Join the courses the device holds to the schools it holds.
 *
 * Scope positions advance independently, so a course can legitimately be here
 * before its school. The join therefore leaves the school out rather than
 * dropping the course: a card without a badge beats a catalogue with a hole in
 * it.
 */
export function toCourseCards(
  courses: readonly LocalCourse[],
  schools: readonly LocalSchool[],
): CourseCardViewModel[] {
  const byId = new Map(schools.map((school) => [school.id, school]))

  return courses.map((course) => ({
    id: course.id,
    schoolId: course.schoolId,
    name: course.name,
    description: course.description,
    schoolName: byId.get(course.schoolId)?.name,
    schoolLogoUrl: byId.get(course.schoolId)?.logoUrl ?? null,
  }))
}
