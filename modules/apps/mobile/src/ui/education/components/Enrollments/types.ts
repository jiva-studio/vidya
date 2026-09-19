import type { EnrollmentId, EnrollmentStatus } from '@vidya/domain'

/**
 * One row of the student's own list.
 *
 * The course name is joined in rather than read from the enrolment, which
 * carries only an id. A course whose row has not arrived yet leaves it empty;
 * the row is still the student's place and is still listed.
 */
export interface EnrollmentViewModel {
  id: EnrollmentId
  courseName: string
  groupName?: string
  status: EnrollmentStatus
}

export interface EnrollmentsListProps {
  items: readonly EnrollmentViewModel[]
}

export interface EnrollmentsListEmits {
  click: [enrollmentId: EnrollmentId]
}

export interface EnrollmentsListItemProps {
  id: string
  courseName: string
  groupName?: string
  status: EnrollmentStatus
}

export interface EnrollmentsListItemEmits {
  click: []
}

export interface EnrollmentReviewStatusProps {
  image: string
  header: string
  text: string
  actionText: string
}

export interface EnrollmentReviewStatusEmits {
  click: []
}
