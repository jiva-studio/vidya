import type { LocalCourse, LocalLesson } from '@vidya/client'

/**
 * The lesson, when it is one this course teaches.
 *
 * The address names a course and a lesson independently, so a lesson of
 * another course can be pasted under this one. Answering with it would draw
 * that lesson inside a course that does not teach it, and the progress
 * recorded on it would be filed against a place on the wrong course.
 */
export const resolveLesson = (
  lesson: LocalLesson | null,
  course: LocalCourse | null,
): LocalLesson | null =>
  lesson !== null && course !== null && lesson.courseId === course.id ? lesson : null
