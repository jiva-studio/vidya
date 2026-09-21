import { education } from '@vidya/client'
import type { PreferredTimes, Weekday } from '@vidya/domain'

/**
 * The hours a student offered, as the screen reads them back to them.
 *
 * `days` are message keys' subjects rather than words: the screen says them in
 * the language it is running in, and the stretch itself is a number of minutes
 * on both sides of the wire.
 */
export interface OfferedHours {
  readonly days: readonly Weekday[]
  readonly hours: string
}

export const toOfferedHours = (times: PreferredTimes | null): OfferedHours[] =>
  times === null
    ? []
    : times.ranges.map((range) => ({
        days: education.orderDays(range.days),
        hours: `${education.formatMinuteOfDay(range.startMinute)}–${education.formatMinuteOfDay(range.endMinute)}`,
      }))
