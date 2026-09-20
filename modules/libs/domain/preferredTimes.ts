/**
 * When a student would like to study, as the request carries it.
 *
 * One rule for both sides: the device runs it before writing to the outbox and
 * the applier runs it before writing to the database, so a client built before
 * the rule existed cannot put a shape into the column that nothing reads back.
 */

/** Minutes from midnight. 1440 is the end of the day, not the start of the next. */
export type MinuteOfDay = number

export const Weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof Weekdays)[number]

/**
 * One stretch of the week, repeated on each of its days.
 *
 * A stretch that crosses midnight is one range whose `endMinute` runs past
 * 1440 — "Monday 22:00–02:00" is `{ days: ['mon'], start: 1320, end: 1560 }`.
 * Splitting it in two would shift the second half onto the next day, and the
 * halves then drift apart on every edit.
 */
export interface TimeRange {
  readonly days: readonly Weekday[]
  readonly startMinute: MinuteOfDay
  readonly endMinute: MinuteOfDay
}

/**
 * When it suits the student, in their own time zone.
 *
 * `timeZone` is an IANA name taken once, when the request is sent: it is a
 * property of the request, not of where the phone happens to be later.
 */
export interface PreferredTimes {
  readonly timeZone: string
  readonly ranges: readonly TimeRange[]
}

/** How many stretches one request carries — a week of days plus one night. */
export const MAX_TIME_RANGES = 8

const MINUTES_IN_DAY = 1440

const isWeekday = (value: unknown): value is Weekday =>
  typeof value === 'string' && (Weekdays as readonly string[]).includes(value)

const isValidDays = (value: unknown): boolean => {
  if (!Array.isArray(value) || value.length === 0) return false
  if (!value.every(isWeekday)) return false

  return new Set(value).size === value.length
}

const isValidMinutes = (start: unknown, end: unknown): boolean => {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false

  const from = start as number
  const to = end as number

  return from >= 0 && from < MINUTES_IN_DAY && to > from && to <= MINUTES_IN_DAY * 2
}

const isValidTimeRange = (value: unknown): value is TimeRange => {
  if (typeof value !== 'object' || value === null) return false

  const range = value as Record<string, unknown>

  return isValidDays(range.days) && isValidMinutes(range.startMinute, range.endMinute)
}

/**
 * The name of the zone is checked for shape only, never for membership.
 *
 * The canonical lists of the device and of the server drift apart whenever a
 * zone is renamed (`Europe/Kiev` → `Kyiv`), and refusing a request over that
 * disagreement would lose it for good.
 */
const isValidTimeZone = (value: unknown): boolean => typeof value === 'string' && value !== ''

export const isValidPreferredTimes = (value: unknown): value is PreferredTimes => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const times = value as Record<string, unknown>
  if (!isValidTimeZone(times.timeZone)) return false

  const { ranges } = times
  if (!Array.isArray(ranges) || ranges.length > MAX_TIME_RANGES) return false

  return ranges.every(isValidTimeRange)
}
