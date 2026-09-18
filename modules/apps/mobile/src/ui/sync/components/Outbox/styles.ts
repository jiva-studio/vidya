import {
  alertCircleOutline,
  checkmarkCircleOutline,
  cloudOfflineOutline,
  cloudUploadOutline,
} from 'ionicons/icons'

import type { SubmissionState } from '../../model/submissionState'

/** One icon and one colour per state, so the four are told apart at a glance. */
export const stateIcons: Record<SubmissionState, string> = {
  notSent: cloudOfflineOutline,
  sending: cloudUploadOutline,
  accepted: checkmarkCircleOutline,
  rejected: alertCircleOutline,
}

export const stateColors: Record<SubmissionState, string> = {
  notSent: 'medium',
  sending: 'primary',
  accepted: 'success',
  rejected: 'warning',
}
