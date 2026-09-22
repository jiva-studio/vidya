import type { CourseId, EnrollmentStatus } from '@vidya/domain'

/**
 * One course as the front page offers it.
 *
 * `schoolName` and `schoolCode` are null while the school itself has not
 * arrived; without a code there is no address to open the course at, so the
 * card names what it knows and leads nowhere. `status` is null for a course
 * the student has never asked about — that is the card that offers to ask.
 */
export interface CourseCard {
  readonly id: CourseId
  readonly name: string
  readonly description: string | null
  readonly schoolName: string | null
  readonly schoolCode: string | null
  readonly status: EnrollmentStatus | null
}

export interface CourseCardProps {
  card: CourseCard
}
