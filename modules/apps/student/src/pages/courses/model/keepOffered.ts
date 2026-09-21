import type { LocalCourse } from '@vidya/client'

/**
 * The courses a school shows, out of everything it has written.
 *
 * A school's unpublished work reaches a student's machine on purpose, so that
 * publishing arrives as a change to a course already known rather than as a
 * course out of nowhere. Which of them a student may see is decided here.
 */
export const keepOffered = (courses: readonly LocalCourse[]): LocalCourse[] =>
  courses.filter((course) => course.status === 'published')
