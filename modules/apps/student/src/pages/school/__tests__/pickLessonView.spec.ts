import { describe, expect, it } from 'vitest'

import { pickLessonView } from '../model'

const asked = {
  reading: false,
  held: true,
  filled: true,
  schemaVersion: 1,
}

describe('pickLessonView', () => {
  it('says it is looking before the first read comes back', () => {
    expect(pickLessonView({ ...asked, reading: true, held: false })).toBe('reading')
  })

  it('draws the lesson this machine holds', () => {
    expect(pickLessonView(asked)).toBe('lesson')
  })

  it('promises the lesson is coming while no run has finished here', () => {
    expect(pickLessonView({ ...asked, held: false, filled: false })).toBe('arriving')
  })

  it('says the lesson is not on this machine once a run has finished and it is still absent', () => {
    expect(pickLessonView({ ...asked, held: false })).toBe('absent')
  })

  it('refuses a lesson written to a shape this build has never heard of', () => {
    expect(pickLessonView({ ...asked, schemaVersion: 2 })).toBe('outdated')
  })

  it('draws a lesson written to an older shape, which this build still reads', () => {
    expect(pickLessonView({ ...asked, schemaVersion: 0 })).toBe('lesson')
  })

  it('says nothing about a shape before there is a lesson to read it from', () => {
    expect(pickLessonView({ ...asked, held: false, schemaVersion: 9 })).toBe('absent')
  })
})
