/**
 * The integrity rule for "when it suits me", checked on both sides.
 *
 * The device runs it before writing to the outbox and the applier runs it
 * before writing to the database, so a client built before the rule existed —
 * or not built by us — cannot put a shape into the column that nothing can
 * read back.
 */

import {
  isValidPreferredTimes,
  MAX_TIME_RANGES,
  PreferredTimes,
  TimeRange,
  Weekdays,
} from '../preferredTimes'

const range = (over: Record<string, unknown> = {}): unknown => ({
  days: ['mon'],
  startMinute: 600,
  endMinute: 720,
  ...over,
})

const times = (over: Record<string, unknown> = {}): unknown => ({
  timeZone: 'Asia/Vladivostok',
  ranges: [range()],
  ...over,
})

const ranges = (count: number): unknown[] =>
  Array.from({ length: count }, (_, index) => range({ startMinute: index, endMinute: index + 1 }))

describe('PreferredTimes shape', () => {
  it('names the seven weekdays starting on Monday', () => {
    expect([...Weekdays]).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })

  it('carries one request through the declared types', () => {
    const evening: TimeRange = { days: ['mon', 'wed'], startMinute: 1080, endMinute: 1260 }
    const wanted: PreferredTimes = { timeZone: 'Europe/Kyiv', ranges: [evening] }

    expect(isValidPreferredTimes(wanted)).toBe(true)
  })
})

describe('isValidPreferredTimes', () => {
  it('refuses anything that is not an object with the two fields', () => {
    for (const value of [null, undefined, 'Europe/Kyiv', 42, [], {}]) {
      expect(isValidPreferredTimes(value)).toBe(false)
    }
  })

  it('refuses a request whose ranges are not a list', () => {
    expect(isValidPreferredTimes(times({ ranges: undefined }))).toBe(false)
    expect(isValidPreferredTimes(times({ ranges: 'mon 10:00' }))).toBe(false)
  })
})

describe('the time zone', () => {
  it('checks the form of the string and nothing else', () => {
    expect(isValidPreferredTimes(times({ timeZone: undefined }))).toBe(false)
    expect(isValidPreferredTimes(times({ timeZone: '' }))).toBe(false)
    expect(isValidPreferredTimes(times({ timeZone: 7 }))).toBe(false)
  })

  it('never refuses a request over the name of the zone', () => {
    // The canonical lists of the device and of the server drift apart when a
    // zone is renamed, so both the old and the new name have to pass.
    for (const timeZone of [
      'Europe/Kyiv',
      'Europe/Kiev',
      'Asia/Kolkata',
      'Asia/Calcutta',
      'Asia/Vladivostok',
      'UTC',
    ]) {
      expect(isValidPreferredTimes(times({ timeZone }))).toBe(true)
    }
  })
})

describe('without Intl.supportedValuesOf', () => {
  const intl = Intl as unknown as Record<string, unknown>
  const supported = intl.supportedValuesOf

  beforeAll(() => {
    delete intl.supportedValuesOf
  })

  afterAll(() => {
    intl.supportedValuesOf = supported
  })

  it('still accepts a valid zone where the method is missing', () => {
    for (const timeZone of ['Europe/Kyiv', 'Asia/Kolkata', 'Asia/Vladivostok']) {
      expect(isValidPreferredTimes(times({ timeZone }))).toBe(true)
    }
  })

  it('still accepts a request that carries no ranges at all', () => {
    expect(isValidPreferredTimes(times({ ranges: [] }))).toBe(true)
  })
})

describe('the days of a range', () => {
  it('refuses a range that names no day', () => {
    expect(isValidPreferredTimes(times({ ranges: [range({ days: [] })] }))).toBe(false)
  })

  it('refuses a day that is not a weekday', () => {
    for (const days of [['monday'], ['mon', 'MON'], [1], [null]]) {
      expect(isValidPreferredTimes(times({ ranges: [range({ days })] }))).toBe(false)
    }
  })

  it('refuses the same day twice in one range', () => {
    expect(isValidPreferredTimes(times({ ranges: [range({ days: ['mon', 'mon'] })] }))).toBe(false)
  })

  it('accepts every weekday once', () => {
    expect(isValidPreferredTimes(times({ ranges: [range({ days: [...Weekdays] })] }))).toBe(true)
  })

  it('refuses days that are not a list', () => {
    expect(isValidPreferredTimes(times({ ranges: [range({ days: 'mon' })] }))).toBe(false)
  })
})

describe('the minutes of a range', () => {
  it('starts the day at midnight and ends the start before it', () => {
    expect(isValidPreferredTimes(times({ ranges: [range({ startMinute: 0 })] }))).toBe(true)
    expect(isValidPreferredTimes(times({ ranges: [range({ startMinute: -1 })] }))).toBe(false)
    expect(
      isValidPreferredTimes(times({ ranges: [range({ startMinute: 1440, endMinute: 1500 })] })),
    ).toBe(false)
  })

  it('refuses an end that does not come after the start', () => {
    expect(
      isValidPreferredTimes(times({ ranges: [range({ startMinute: 600, endMinute: 600 })] })),
    ).toBe(false)
    expect(
      isValidPreferredTimes(times({ ranges: [range({ startMinute: 600, endMinute: 540 })] })),
    ).toBe(false)
  })

  it('lets a range end exactly at the end of the day', () => {
    expect(
      isValidPreferredTimes(times({ ranges: [range({ startMinute: 1380, endMinute: 1440 })] })),
    ).toBe(true)
  })

  it('refuses an end beyond the following midnight', () => {
    expect(
      isValidPreferredTimes(times({ ranges: [range({ startMinute: 1320, endMinute: 2881 })] })),
    ).toBe(false)
    expect(
      isValidPreferredTimes(times({ ranges: [range({ startMinute: 0, endMinute: 2880 })] })),
    ).toBe(true)
  })

  it('refuses minutes that are not whole numbers', () => {
    expect(isValidPreferredTimes(times({ ranges: [range({ startMinute: 600.5 })] }))).toBe(false)
    expect(isValidPreferredTimes(times({ ranges: [range({ endMinute: 720.5 })] }))).toBe(false)
    expect(isValidPreferredTimes(times({ ranges: [range({ startMinute: '600' })] }))).toBe(false)
    expect(isValidPreferredTimes(times({ ranges: [range({ endMinute: Number.NaN })] }))).toBe(false)
  })
})

describe('a night that crosses midnight', () => {
  it('is one range whose end runs past the day', () => {
    const night = times({ ranges: [range({ days: ['mon'], startMinute: 1320, endMinute: 1560 })] })

    expect(isValidPreferredTimes(night)).toBe(true)
  })
})

describe('how many ranges one request carries', () => {
  it('stops at eight, a week plus one night', () => {
    expect(MAX_TIME_RANGES).toBe(8)
  })

  it('accepts none, and accepts the full count', () => {
    expect(isValidPreferredTimes(times({ ranges: [] }))).toBe(true)
    expect(isValidPreferredTimes(times({ ranges: ranges(MAX_TIME_RANGES) }))).toBe(true)
  })

  it('refuses one more than the full count', () => {
    expect(isValidPreferredTimes(times({ ranges: ranges(MAX_TIME_RANGES + 1) }))).toBe(false)
  })
})
