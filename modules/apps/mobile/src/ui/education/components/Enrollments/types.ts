import type { EnrollmentId, EnrollmentStatus } from '@vidya/domain'
import type { CourseSummary, EnrollmentSummary, GroupSummary } from '@vidya/protocol'

export interface EnrollmentViewModel {
  enrollment: EnrollmentSummary
  group?: GroupSummary
  course: CourseSummary
}

export interface EnrollmentsListProps {
  items: EnrollmentViewModel[]
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
