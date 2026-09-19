import type { EnrollmentId } from '@vidya/domain'

import type { EnrollmentRow } from '@/entities/enrollment'

export interface ModerationActionsProps {
  enrollment: EnrollmentRow

  /** Without `enrollments:moderate` the actions are absent, not disabled. */
  canModerate?: boolean

  busy?: boolean
}

export interface ModerationActionsEmits {
  accept: [id: EnrollmentId]
  decline: [id: EnrollmentId]
  'assign-group': [id: EnrollmentId]
}
