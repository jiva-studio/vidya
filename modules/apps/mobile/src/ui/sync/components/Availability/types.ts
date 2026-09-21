export interface OfflineBannerProps {
  /** Whether the device has a connection right now. */
  online: boolean

  /** Whether a sync run is going on at this moment. */
  syncing?: boolean
}

export interface BackfillProgressProps {
  /** Items already on the device. */
  done: number

  /** Items the first run expects to bring; `0` while it is still counting. */
  total: number
}

export interface SignInAgainNoticeProps {
  /** How many of the student's schools are waiting for a new sign-in. */
  schools: number
}

export interface SignInAgainNoticeEmits {
  'sign-in': []
}

/** How a place ended: the school took it back, or the student handed it back. */
export type EnrollmentEnding = 'revoked' | 'withdrawn'

export interface RevokedEnrollmentNoticeProps {
  courseName: string

  /** Which of the two endings to explain. */
  reason?: EnrollmentEnding

  /** Whether anything of this course is already on the device. */
  hasDownloadedContent?: boolean
}

export interface RevokedEnrollmentNoticeEmits {
  'open-downloaded': []
}
