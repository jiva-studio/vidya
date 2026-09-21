import type { EnrollmentStatus } from '@vidya/domain'
import type { BadgeTone } from '@vidya/ui'

/** How a place is said on a screen: a message key and the colour it is said in. */
export interface PlaceBadge {
  readonly key: string
  readonly tone: BadgeTone
}

/**
 * Each of the five ends a place can be at is said in its own words.
 *
 * A school turning someone away, a school taking the place back and a student
 * handing it in are three different things, and one word for all of them would
 * tell a student they were refused when nobody refused them.
 */
const BADGES: Record<EnrollmentStatus, PlaceBadge> = {
  pending: { key: 'place-pending', tone: 'warning' },
  accepted: { key: 'place-accepted', tone: 'success' },
  declined: { key: 'place-declined', tone: 'danger' },
  revoked: { key: 'place-revoked', tone: 'danger' },
  withdrawn: { key: 'place-withdrawn', tone: 'neutral' },
}

export const describePlace = (status: EnrollmentStatus): PlaceBadge => BADGES[status]
