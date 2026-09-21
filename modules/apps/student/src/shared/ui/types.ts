import type { SubmissionState } from '@vidya/client'
import type { SyncRejectionReason } from '@vidya/domain'

export interface BackfillProgressProps {
  /** Records that have reached this machine so far. */
  rows: number

  /** Whether a run is going on at this moment. */
  running?: boolean
}

/** One record's journey to the school, and why it ended where it did. */
export interface SubmissionNoticeProps {
  state: SubmissionState

  /** Only a refused record carries one; it names why no later push will take it. */
  reason?: SyncRejectionReason
}
