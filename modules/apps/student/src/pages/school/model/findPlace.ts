import type { LocalEnrollment } from '@vidya/client'
import type { CourseId } from '@vidya/domain'

import type { LocalEducation } from '@/shared/data'

/**
 * The request this course's screen is about.
 *
 * A course carries a history of requests — asked for, turned down, asked for
 * again — so the live one answers wherever there is one. Where there is not,
 * the newest finished one does: the screen exists to say what became of the
 * asking, and the answer a student is waiting to read is the last one.
 */
export const findPlace = async (
  education: LocalEducation,
  courseId: CourseId,
): Promise<LocalEnrollment | null> => {
  const live = await education.enrollments.getLiveByCourse(courseId)
  if (live !== null) return live

  const past = (await education.enrollments.list()).filter((place) => place.courseId === courseId)

  return past.toSorted((one, other) => other.createdAt.localeCompare(one.createdAt))[0] ?? null
}
