import { describe, expect, it } from 'vitest'

import { isGradeGiven, parseGrade } from '../model'

describe('grades', () => {
  it('reads a whole mark out of what was typed', () => {
    expect(parseGrade('73')).toBe(73)
    expect(parseGrade('0')).toBe(0)
  })

  it('keeps a mark inside the bounds the server validates', () => {
    expect(parseGrade('180')).toBe(100)
  })

  it('ignores everything that is not a digit', () => {
    expect(parseGrade('')).toBeUndefined()
    expect(parseGrade('abc')).toBeUndefined()
    expect(parseGrade('8,5')).toBe(85)
  })

  it('accepts only a whole mark within the bounds', () => {
    expect(isGradeGiven(undefined)).toBe(false)
    expect(isGradeGiven(4.5)).toBe(false)
    expect(isGradeGiven(101)).toBe(false)
    expect(isGradeGiven(0)).toBe(true)
    expect(isGradeGiven(100)).toBe(true)
  })
})
