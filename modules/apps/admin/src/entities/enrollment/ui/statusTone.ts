import type { EnrollmentStatus } from '@vidya/domain'
import type { BadgeTone } from '@vidya/ui'

/**
 * How each state of a request reads.
 *
 * Keyed by the domain's own list, so a state added there shows up here as a
 * type error rather than as a row with no badge.
 */
export const enrollmentTones: Record<EnrollmentStatus, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'neutral',
}

export const enrollmentLabels: Record<EnrollmentStatus, string> = {
  pending: 'enrollment-status-pending',
  accepted: 'enrollment-status-accepted',
  declined: 'enrollment-status-declined',
}
