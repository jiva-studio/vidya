/**
 * How far an answer has travelled towards the school, as the student sees it.
 *
 * The device stores three statuses (`pending`, `pushed`, `rejected`); the
 * screen shows four, because "saved here" and "on its way right now" feel
 * nothing alike to somebody waiting. `sending` is therefore not a stored
 * status but the run in progress, passed in beside the row.
 */

import type { OutboxStatus } from '@vidya/domain'

export const SubmissionStates = ['notSent', 'sending', 'accepted', 'rejected'] as const

export type SubmissionState = (typeof SubmissionStates)[number]

/**
 * Names the state of one journaled answer. `inFlight` is whether the push that
 * carries this very row is running, which only the sync engine knows.
 */
export function submissionStateOf(status: OutboxStatus, inFlight = false): SubmissionState {
  if (status === 'rejected') return 'rejected'
  if (status === 'pushed') return 'accepted'

  return inFlight ? 'sending' : 'notSent'
}
