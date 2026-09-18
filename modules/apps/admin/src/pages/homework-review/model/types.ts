import type { LessonId } from '@vidya/domain'

/** Everything about the open work that its own record does not carry. */
export interface ReviewWorkContext {
  studentName?: string
  courseName?: string
  groupName?: string
  reviewerName?: string

  /** The lesson holding the version answered, once it has been found. */
  lessonId?: LessonId
  lessonTitle?: string
}
