import type { EnrollmentStatus } from '@vidya/domain'

/** The one thing a request offers to do with itself, given where it stands. */
export type EnrollmentAction = 'cancel' | 'leave' | 'remove'

/**
 * An offer as the swipe and the danger button draw it.
 *
 * `confirmation` is the question asked first; an offer without one is carried
 * out on the tap. Only what the app cannot reverse is worth a question, and
 * putting a finished row away is reversible from the toast that follows it.
 */
export interface EnrollmentActionView {
  readonly action: EnrollmentAction
  readonly label: string
  readonly confirmation?: string
  readonly color: 'danger' | 'medium'
}

const CANCEL: EnrollmentActionView = {
  action: 'cancel',
  label: 'enrollment-action-cancel',
  confirmation: 'enrollment-action-cancel-confirm',
  color: 'danger',
}

const LEAVE: EnrollmentActionView = {
  action: 'leave',
  label: 'enrollment-action-leave',
  confirmation: 'enrollment-action-leave-confirm',
  color: 'danger',
}

const REMOVE: EnrollmentActionView = {
  action: 'remove',
  label: 'enrollment-action-remove',
  color: 'medium',
}

/**
 * A request that is still running is answered rather than tidied away, so a
 * live row is never offered the way out of the list. A row the student has
 * already handed back is offered nothing: it left the list with the same write.
 */
const BY_STATUS: Readonly<Record<EnrollmentStatus, EnrollmentActionView | null>> = Object.freeze({
  pending: CANCEL,
  accepted: LEAVE,
  declined: REMOVE,
  revoked: REMOVE,
  withdrawn: null,
})

export const actionFor = (status: EnrollmentStatus): EnrollmentActionView | null =>
  BY_STATUS[status]
