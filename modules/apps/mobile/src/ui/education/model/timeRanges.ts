import type { PreferredTimes, TimeRange, Weekday } from '@vidya/domain'
import { isValidPreferredTimes, Weekdays } from '@vidya/domain'

/**
 * The time a student offers, as the screen collects it.
 *
 * The presets are the product's, so they live here and their names live in the
 * bundles: a school does not configure them, and a human reads what they
 * produce.
 */

const HOUR = 60
const END_OF_DAY = 24 * HOUR

const WORKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri']
const WEEKEND: readonly Weekday[] = ['sat', 'sun']

export interface TimeRangePreset {
  /** Names the bundle key `time-preset-…`; the preset carries no text itself. */
  readonly key: string
  readonly range: TimeRange
}

export const TIME_RANGE_PRESETS: readonly TimeRangePreset[] = [
  { key: 'weekend-morning', range: { days: WEEKEND, startMinute: 0, endMinute: 11 * HOUR } },
  { key: 'weekday-morning', range: { days: WORKDAYS, startMinute: 0, endMinute: 9 * HOUR } },
  {
    key: 'weekday-evening',
    range: { days: WORKDAYS, startMinute: 18 * HOUR, endMinute: END_OF_DAY },
  },
  { key: 'any-time', range: { days: Weekdays, startMinute: 0, endMinute: END_OF_DAY } },
]

/**
 * The days an interval a student draws themselves starts with.
 *
 * All of them: an offer of time is a wish rather than a limit, so "any day
 * suits me" is the honest opening, and narrowing it is one tap.
 */
export const everyDay = (): readonly Weekday[] => Weekdays

/** Reads 1440 as the far side of midnight and an hour past it as the next day. */
export const formatMinuteOfDay = (minute: number): string => {
  const hour = minute === END_OF_DAY ? 24 : Math.floor(minute / HOUR) % 24

  return `${String(hour).padStart(2, '0')}:${String(minute % HOUR).padStart(2, '0')}`
}

/** The days of one interval in the week's own order, whatever order they arrived in. */
export const orderDays = (days: readonly Weekday[]): Weekday[] =>
  Weekdays.filter((day) => days.includes(day))

const compareRanges = (left: TimeRange, right: TimeRange): number =>
  left.startMinute - right.startMinute ||
  left.endMinute - right.endMinute ||
  orderDays(left.days).join().localeCompare(orderDays(right.days).join())

/**
 * What the request carries, or `null` when there is nothing to carry.
 *
 * The order is canonical — by start, by end, then by days — because the row
 * travels as `jsonb` and a repeat of the same push is recognised by comparing
 * the body: the same wish written in another order would be read as a change.
 *
 * The rule that decides is the domain's own, so the device refuses here
 * exactly what the server would refuse later.
 */
export const buildPreferredTimes = (
  ranges: readonly TimeRange[],
  timeZone: string,
): PreferredTimes | null => {
  if (ranges.length === 0) return null

  const times: PreferredTimes = {
    timeZone,
    ranges: ranges.map((range) => ({ ...range, days: orderDays(range.days) })).sort(compareRanges),
  }

  return isValidPreferredTimes(times) ? times : null
}

/** The zone the student named those hours in, taken from the phone. */
export const readTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone
