import type { LocalCourse } from '@vidya/client'
import type { SchoolId } from '@vidya/domain'

/**
 * The courses of one school that the school actually shows.
 *
 * Drafts reach the device on purpose: the school's journal carries every
 * course it has, so that a course leaving draft arrives as a change to the row
 * already sent rather than as a row that appears from nowhere. Which of them a
 * student may see is decided here, at the catalogue, and not on the way in —
 * a course unpublished after someone enrolled on it still has lessons they
 * hold and a journal they keep writing to.
 */
export const keepPublished = (courses: readonly LocalCourse[], schoolId: SchoolId): LocalCourse[] =>
  courses.filter((course) => course.schoolId === schoolId && course.status === 'published')
