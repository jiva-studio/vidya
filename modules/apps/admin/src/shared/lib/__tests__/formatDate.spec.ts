import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime } from '../formatDate'

describe('formatDate', () => {
  it('shows a day without a time', () => {
    expect(formatDate('2026-03-14T09:05:00.000Z', 'en-GB')).toBe('14 Mar 2026')
  })

  it('accepts a Date as readily as an ISO string', () => {
    expect(formatDate(new Date('2026-03-14T09:05:00.000Z'), 'en-GB')).toBe('14 Mar 2026')
  })

  it.each([undefined, null, '', 'not a date'])('shows a dash for %s', (value) => {
    expect(formatDate(value as string | undefined, 'en-GB')).toBe('—')
    expect(formatDateTime(value as string | undefined, 'en-GB')).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('adds the hour and the minute', () => {
    const shown = formatDateTime('2026-03-14T09:05:00.000Z', 'en-GB')

    expect(shown).toContain('14 Mar 2026')
    expect(shown).toMatch(/\d{2}:\d{2}/)
  })

  it('shows the time in the local zone, not in UTC', () => {
    const iso = '2026-03-14T23:30:00.000Z'
    const expected = new Date(iso).getHours().toString().padStart(2, '0')

    expect(formatDateTime(iso, 'en-GB')).toContain(`${expected}:30`)
  })
})
