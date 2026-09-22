import { describe, expect, it } from 'vitest'

import { type CatalogueViewInput, pickCatalogueView } from '../model'

const input = (overrides: Partial<CatalogueViewInput> = {}): CatalogueViewInput => ({
  reading: false,
  found: true,
  courses: 1,
  filled: true,
  ...overrides,
})

describe('what a school catalogue has to say', () => {
  it('says it is reading before the database has answered', () => {
    expect(pickCatalogueView(input({ reading: true, found: false, courses: 0 }))).toBe('reading')
  })

  it('promises the school is coming while no run has finished here', () => {
    expect(pickCatalogueView(input({ found: false, courses: 0, filled: false }))).toBe('arriving')
  })

  it('says the school is not on this machine once a run has finished', () => {
    expect(pickCatalogueView(input({ found: false, courses: 0 }))).toBe('absent')
  })

  it('does not call a school empty while its courses may still be coming', () => {
    expect(pickCatalogueView(input({ courses: 0, filled: false }))).toBe('arriving')
  })

  it('says the school shows nothing once a run has finished and found none', () => {
    expect(pickCatalogueView(input({ courses: 0 }))).toBe('empty')
  })

  it('shows the courses as soon as there are any, run or no run', () => {
    expect(pickCatalogueView(input({ filled: false }))).toBe('courses')
  })
})
