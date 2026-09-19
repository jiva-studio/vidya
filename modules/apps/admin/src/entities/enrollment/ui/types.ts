import type { EnrollmentStatus } from '@vidya/domain'

export interface EnrollmentStatusBadgeProps {
  status: EnrollmentStatus

  /** Accepted and still without a group. Shown instead of the bare status. */
  inQueue?: boolean
}
