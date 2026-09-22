import { describe, expect, it } from 'vitest'

import { hasMovedOn } from './mediaProgress'

describe('hasMovedOn', () => {
  it('holds back a position a few seconds from the one already recorded', () => {
    expect(hasMovedOn(12, 0)).toBe(false)
  })

  it('records again once play has run on for minutes', () => {
    expect(hasMovedOn(400, 0)).toBe(true)
  })

  it('counts a jump backwards as movement, so rewinding is remembered too', () => {
    expect(hasMovedOn(10, 600)).toBe(true)
  })
})
