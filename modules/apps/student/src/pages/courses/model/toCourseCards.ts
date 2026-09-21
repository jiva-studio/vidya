import type { LocalCourse, LocalEnrollment, LocalSchool } from '@vidya/client'
import { isLive } from '@vidya/domain'

import type { CourseCard } from '../types'

const findPlace = (
  places: readonly LocalEnrollment[],
  course: LocalCourse,
): LocalEnrollment | null => {
  const mine = places.filter((place) => place.courseId === course.id)

  return mine.find((place) => isLive(place.status)) ?? mine[0] ?? null
}

/**
 * Every course on offer, each carrying its school and where the student stands
 * with it.
 *
 * A course whose school has not arrived keeps its place in the list: the
 * schools and their courses travel apart, and a hole in the catalogue is worse
 * than a card with no label on it. A course asked about twice shows the live
 * request, because that is the one the student is waiting on.
 */
export const toCourseCards = (
  courses: readonly LocalCourse[],
  schools: readonly LocalSchool[],
  places: readonly LocalEnrollment[],
): CourseCard[] => {
  const schoolById = new Map(schools.map((school) => [school.id, school]))

  return courses.map((course) => ({
    id: course.id,
    name: course.name,
    description: course.description,
    schoolName: schoolById.get(course.schoolId)?.name ?? null,
    schoolCode: schoolById.get(course.schoolId)?.code ?? null,
    status: findPlace(places, course)?.status ?? null,
  }))
}
