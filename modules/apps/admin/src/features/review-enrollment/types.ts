import type { GroupId } from '@vidya/domain'

import type { EnrollmentRow } from '@/entities/enrollment'

export interface EnrollmentReviewDialogProps {
  open?: boolean

  /** The request under review; absent while the dialog is closed. */
  enrollment?: EnrollmentRow

  busy?: boolean
  error?: string
}

export interface EnrollmentReviewDialogEmits {
  'update:open': [open: boolean]
  accept: [groupId: GroupId | undefined]
}
