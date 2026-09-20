import type { EnrollmentId } from '@vidya/domain'

import type { EnrollmentRow } from '@/entities/enrollment'

export interface ArchiveActionProps {
  enrollment: EnrollmentRow

  /** Without `enrollments:moderate` the action is absent, not disabled. */
  canModerate?: boolean

  busy?: boolean
}

export interface ArchiveActionEmits {
  archive: [id: EnrollmentId]
}
