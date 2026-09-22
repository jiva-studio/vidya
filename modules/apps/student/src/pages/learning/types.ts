import type { CourseId, EnrollmentId, EnrollmentStatus } from '@vidya/domain'

/**
 * One course the student holds a place on, wherever it is taught.
 *
 * `courseName`, `schoolName` and `schoolCode` are null while the row they name
 * has not arrived: the places, the courses and the schools travel in scopes
 * that advance apart, and a place is the student's whether or not the card
 * around it can be filled in yet. Without a code there is no address for the
 * school, so the card names it without leading anywhere.
 */
export interface LearningCard {
  readonly id: EnrollmentId
  readonly courseId: CourseId
  readonly courseName: string | null
  readonly schoolName: string | null
  readonly schoolCode: string | null
  readonly status: EnrollmentStatus
}

export interface LearningCardProps {
  card: LearningCard
}
