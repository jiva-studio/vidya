import type { Weekday } from '@vidya/domain'

/** Named one by one rather than assembled, so a new weekday fails to compile. */
export const weekdayLabels: Record<Weekday, string> = {
  mon: 'weekday-mon',
  tue: 'weekday-tue',
  wed: 'weekday-wed',
  thu: 'weekday-thu',
  fri: 'weekday-fri',
  sat: 'weekday-sat',
  sun: 'weekday-sun',
}
