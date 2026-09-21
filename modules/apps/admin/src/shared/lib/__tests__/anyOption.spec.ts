import { describe, expect, it } from 'vitest'

import { ANY, asFilter, asSelected } from '../anyOption'

describe('the "any" row of a filter select', () => {
  it('shows the sentinel for a filter nobody has set', () => {
    expect(asSelected(undefined)).toBe(ANY)
  })

  it('shows the value for a filter that is set', () => {
    expect(asSelected('pending')).toBe('pending')
  })

  it('reads the sentinel back as no narrowing', () => {
    expect(asFilter(ANY)).toBeUndefined()
  })

  // reka refuses an empty option value, so the sentinel exists at all; a select
  // that never took one can still hand the empty string back.
  it('reads an empty value back as no narrowing', () => {
    expect(asFilter('')).toBeUndefined()
  })

  it('passes anything else through', () => {
    expect(asFilter('accepted')).toBe('accepted')
    expect(asFilter('6eb216f2-543d-4f15-88f5-f325a1bdcafd')).toBe(
      '6eb216f2-543d-4f15-88f5-f325a1bdcafd',
    )
  })

  it('round-trips a set filter', () => {
    expect(asFilter(asSelected('accepted'))).toBe('accepted')
    expect(asFilter(asSelected(undefined))).toBeUndefined()
  })
})
