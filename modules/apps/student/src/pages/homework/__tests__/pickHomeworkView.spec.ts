import { describe, expect, it } from 'vitest'

import { pickHomeworkView } from '../model'

const view = (over: Partial<Parameters<typeof pickHomeworkView>[0]> = {}) =>
  pickHomeworkView({ reading: false, answers: 0, filled: true, ...over })

describe('pickHomeworkView', () => {
  it('says it is still looking before the first answer is in', () => {
    expect(view({ reading: true })).toBe('reading')
  })

  it('lists the answers it found', () => {
    expect(view({ answers: 2 })).toBe('answers')
  })

  it('promises the work is coming while no run has finished here', () => {
    expect(view({ filled: false })).toBe('arriving')
  })

  it('says there is none only once a run has finished', () => {
    expect(view()).toBe('empty')
  })

  it('lists what it holds even before a run has finished, rather than promising more', () => {
    expect(view({ answers: 1, filled: false })).toBe('answers')
  })
})
