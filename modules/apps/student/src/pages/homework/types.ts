import type { LocalHomework } from '@vidya/client'
import type { CourseId, LessonId, SchoolId } from '@vidya/domain'

/**
 * One answer as the student's own list shows it: what it was written on, and
 * where it stands.
 *
 * The three names can each be absent. An answer and the lesson it belongs to
 * ride scopes that advance apart, so a list drawn only from what is complete
 * would hide the student's own work until the content caught up; the card says
 * what it knows and names the rest as not arrived.
 */
export interface HomeworkCard {
  readonly answer: LocalHomework
  readonly lessonTitle: string | null
  readonly courseName: string | null
  readonly schoolCode: string | null
  readonly schoolId: SchoolId
  readonly courseId: CourseId | null
  readonly lessonId: LessonId | null
}

export interface HomeworkCardProps {
  card: HomeworkCard
}
