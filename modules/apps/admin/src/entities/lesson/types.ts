import type { CourseId, LessonId } from '@vidya/domain'

/**
 * Where a lesson's content stands, as the list shows it.
 *
 * The three states follow the server's rules rather than the column: every
 * lesson is created with a draft of version 1, only one draft may be open at a
 * time, and a new revision starts from the last published content. So a lesson
 * is being written (`draft`), is live (`published`), or is live with a revision
 * in progress (`revising`).
 */
export type LessonVersionState = 'draft' | 'published' | 'revising'

/** One row of the lessons list: the lesson plus what its versions add up to. */
export type LessonRow = {
  id: LessonId
  courseId: CourseId
  lessonNumber: number
  title: string
  state?: LessonVersionState
  publishedVersion?: number
  draftVersion?: number
}

/** What the "add a lesson" dialog holds. The number is the list's, not the typist's. */
export interface LessonFormValues {
  title: string
}
