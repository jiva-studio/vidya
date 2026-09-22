import type { EnrollmentStatus, IsoDateTime } from '@vidya/domain'
import type { ButtonVariant } from '@vidya/ui'

import type { PlaceActionName } from '../types'

/**
 * An offer as the screen draws it.
 *
 * `confirmation` is the question asked first; an offer without one is carried
 * out on the click. Only what this application cannot undo is worth a
 * question, and putting a finished request away is undone by the button that
 * replaces it.
 */
export interface PlaceAction {
  readonly action: PlaceActionName
  readonly label: string
  readonly confirmation?: string
  readonly variant: ButtonVariant
}

/** Where a request stands, as far as deciding what to offer about it goes. */
export interface PlaceStanding {
  readonly status: EnrollmentStatus
  readonly archivedByStudentAt: IsoDateTime | null
}

const CANCEL: PlaceAction = {
  action: 'withdraw',
  label: 'place-cancel',
  confirmation: 'place-cancel-confirm',
  variant: 'danger',
}

const LEAVE: PlaceAction = {
  action: 'withdraw',
  label: 'place-leave',
  confirmation: 'place-leave-confirm',
  variant: 'danger',
}

const PUT_AWAY: PlaceAction = { action: 'archive', label: 'place-archive', variant: 'secondary' }

const BRING_BACK: PlaceAction = {
  action: 'unarchive',
  label: 'place-unarchive',
  variant: 'secondary',
}

/**
 * Handing a request back and leaving a course are one write and two different
 * things to be told: a student who asked has nothing yet to lose, and a
 * student who was taken on loses the course.
 */
const BY_STATUS: Readonly<Record<EnrollmentStatus, PlaceAction>> = Object.freeze({
  pending: CANCEL,
  accepted: LEAVE,
  declined: PUT_AWAY,
  revoked: PUT_AWAY,
  withdrawn: PUT_AWAY,
})

export const describePlaceAction = (place: PlaceStanding): PlaceAction =>
  place.archivedByStudentAt === null ? BY_STATUS[place.status] : BRING_BACK
