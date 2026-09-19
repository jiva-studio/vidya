import type { SyncRejectionReason } from '@vidya/domain'

import type { SubmissionState } from '../../model/submissionState'

export interface SyncStateBadgeProps {
  state: SubmissionState
}

export interface SyncRejectionNoticeProps {
  reason: SyncRejectionReason
}

export interface SubmittedHomeworkItemProps {
  /** The answer as it stands on the device — shown whatever the state is. */
  answerText: string

  state: SubmissionState

  /**
   * The lesson the answer belongs to. Absent when its version has not reached
   * the device yet: scope positions move independently, so an answer may
   * legitimately arrive before its parent.
   */
  lessonTitle?: string

  /** Set exactly when `state` is `rejected`. */
  reason?: SyncRejectionReason
}
