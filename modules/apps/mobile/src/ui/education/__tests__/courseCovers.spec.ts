import { describe, expect, it } from 'vitest'

import { COVER_TONES, coverInitialOf, coverToneOf } from '../model/courseCovers'

/**
 * A course has no picture of its own yet, so the catalogue draws one. What it
 * draws has to be settled by the course itself: a cover re-picked on each
 * render would flicker down the list and would not stay the same course's face
 * between one opening of the app and the next.
 */
describe('a course cover is settled by the course', () => {
  it('answers the same tone every time it is asked', () => {
    expect(coverToneOf('Sanskrit, first steps')).toBe(coverToneOf('Sanskrit, first steps'))
  })

  it('stays inside the tones the theme defines', () => {
    const tones = ['Sanskrit', 'Bhakti', 'Devanagari', 'Kirtan', 'Vedanta', ''].map(coverToneOf)

    expect(tones.every((tone) => COVER_TONES.includes(tone))).toBe(true)
  })

  it('tells neighbours apart rather than painting a list one colour', () => {
    const tones = new Set(['Sanskrit walk', 'Sanskrit, first steps', 'Kirtan'].map(coverToneOf))

    expect(tones.size).toBeGreaterThan(1)
  })

  it('carries the first letter of the course', () => {
    expect(coverInitialOf('  sanskrit walk ')).toBe('S')
  })

  it('carries nothing for a course with no name to take a letter from', () => {
    expect(coverInitialOf('   ')).toBe('')
  })
})
