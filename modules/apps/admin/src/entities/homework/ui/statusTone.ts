import type { HomeworkStatus } from '@vidya/domain'
import type { BadgeTone } from '@vidya/ui'

/**
 * How each state of a piece of work reads.
 *
 * Keyed by the domain's own list: a state added there shows up here as a type
 * error rather than as a row with no badge.
 */
export const homeworkTones: Record<HomeworkStatus, BadgeTone> = {
  open: 'neutral',
  pending: 'warning',
  in_review: 'info',
  returned: 'danger',
  accepted: 'success',
}

export const homeworkLabels: Record<HomeworkStatus, string> = {
  open: 'homework-status-open',
  pending: 'homework-status-pending',
  in_review: 'homework-status-in-review',
  returned: 'homework-status-returned',
  accepted: 'homework-status-accepted',
}
