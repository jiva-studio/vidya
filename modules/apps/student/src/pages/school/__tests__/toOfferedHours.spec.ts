import { describe, expect, it } from 'vitest'

import { toOfferedHours } from '../model'

const times = (ranges: { days: readonly string[]; startMinute: number; endMinute: number }[]) =>
  ({ timeZone: 'Europe/Belgrade', ranges }) as never

describe('the hours read back to the student', () => {
  it('says nothing where the request carried no hours', () => {
    expect(toOfferedHours(null)).toEqual([])
  })

  it('reads a stretch as the clock says it', () => {
    const read = toOfferedHours(times([{ days: ['mon'], startMinute: 1080, endMinute: 1440 }]))

    expect(read[0]!.hours).toBe('18:00–24:00')
  })

  it('reads an hour past midnight as the next day rather than as hour 25', () => {
    const read = toOfferedHours(times([{ days: ['mon'], startMinute: 1320, endMinute: 1500 }]))

    expect(read[0]!.hours).toBe('22:00–01:00')
  })

  it('puts the days in the order of the week, whatever order they were stored in', () => {
    const read = toOfferedHours(times([{ days: ['wed', 'mon'], startMinute: 0, endMinute: 60 }]))

    expect(read[0]!.days).toEqual(['mon', 'wed'])
  })

  it('reads every stretch the request carries', () => {
    const read = toOfferedHours(
      times([
        { days: ['sat'], startMinute: 0, endMinute: 60 },
        { days: ['sun'], startMinute: 60, endMinute: 120 },
      ]),
    )

    expect(read).toHaveLength(2)
  })
})
