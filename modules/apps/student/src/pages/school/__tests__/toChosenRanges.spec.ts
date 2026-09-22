import { education } from '@vidya/client'
import { describe, expect, it } from 'vitest'

import { toChosenRanges } from '../model'

const keyOf = (index: number) => education.TIME_RANGE_PRESETS[index]!.key

describe('the hours a student offers', () => {
  it('carries nothing while the student has chosen nothing', () => {
    expect(toChosenRanges([])).toEqual([])
  })

  it('carries the stretch behind each chosen preset', () => {
    expect(toChosenRanges([keyOf(1)])).toEqual([education.TIME_RANGE_PRESETS[1]!.range])
  })

  it('keeps the presets in the order they are offered, whatever order they were picked in', () => {
    const picked = toChosenRanges([keyOf(2), keyOf(0)])

    expect(picked).toEqual([
      education.TIME_RANGE_PRESETS[0]!.range,
      education.TIME_RANGE_PRESETS[2]!.range,
    ])
  })

  it('passes over a name no preset carries', () => {
    expect(toChosenRanges(['an-hour-that-does-not-exist'])).toEqual([])
  })

  it('offers each stretch once, however many times it was named', () => {
    expect(toChosenRanges([keyOf(0), keyOf(0)])).toEqual([education.TIME_RANGE_PRESETS[0]!.range])
  })
})
