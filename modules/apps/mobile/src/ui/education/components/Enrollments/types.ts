import type {
  EnrollmentId,
  EnrollmentStatus,
  IsoDateTime,
  SyncRejectionReason,
} from '@vidya/domain'

import type { EnrollmentActionView } from '../../model/enrollmentActions'

/**
 * One row of the student's own list.
 *
 * The course and group names are joined in rather than read from the enrolment,
 * which carries only ids. A course whose row has not arrived yet leaves the
 * name empty; the row is still the student's place and is still listed.
 *
 * `requestedAt` is what tells two attempts at one course apart: with a history
 * behind them, last year's finished row and this year's live one carry the
 * same course name and nothing else to read them by.
 */
export interface EnrollmentViewModel {
  id: EnrollmentId
  courseName: string
  groupName?: string
  status: EnrollmentStatus
  requestedAt?: IsoDateTime
}

export interface EnrollmentsListProps {
  items: readonly EnrollmentViewModel[]
}

export interface EnrollmentsListEmits {
  click: [enrollmentId: EnrollmentId]
  action: [enrollmentId: EnrollmentId, action: EnrollmentActionView]
}

export interface EnrollmentsListItemProps {
  id: string
  courseName: string
  groupName?: string
  status: EnrollmentStatus
  requestedAt?: IsoDateTime
}

export interface EnrollmentsListItemEmits {
  click: []
  action: [action: EnrollmentActionView]
}

export interface EnrollmentReviewStatusProps {
  image: string
  header: string
  text: string
  actionText: string

  /** The way out the outcome offers, when it offers one. */
  dangerActionText?: string

  /** The question asked before it; absent carries the action out on the tap. */
  dangerActionAlert?: string
}

export interface EnrollmentReviewStatusEmits {
  click: [action: 'normal' | 'danger']
}

export interface EnrollmentDangerActionProps {
  action: EnrollmentActionView
}

export interface EnrollmentDangerActionEmits {
  confirm: []
}

export interface EnrollmentRejectionNoticeProps {
  reason: SyncRejectionReason
}
