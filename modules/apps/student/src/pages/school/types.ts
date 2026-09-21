import type { LocalCourse } from '@vidya/client'
import type { EnrollmentStatus, LessonId } from '@vidya/domain'

/**
 * One lesson as the course screen lists it.
 *
 * `blocks` and `done` are counted from what this machine holds — the blocks of
 * the published version it has, and the states the student has written against
 * them. `held` is false while the version itself has not arrived, which is why
 * a lesson can be listed with nothing to count.
 */
export interface LessonRow {
  readonly id: LessonId
  readonly number: number
  readonly title: string
  readonly blocks: number
  readonly done: number
  readonly held: boolean
}

export interface CourseCardProps {
  course: LocalCourse

  /** The public code of the school the address is written under. */
  code: string
}

export interface LessonRowProps {
  row: LessonRow
  code: string
  courseId: string
}

export interface CoursePlaceProps {
  /** The place the student holds on this course, or null when they hold none. */
  status: EnrollmentStatus | null
}

export interface LessonOutdatedEmits {
  reload: []
}
