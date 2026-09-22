import { describe, expect, it } from 'vitest'

import { type CoursesViewInput, pickCoursesView } from '../model'

const at = (overrides: Partial<CoursesViewInput> = {}) =>
  pickCoursesView({
    reading: false,
    schools: 1,
    courses: 1,
    filled: true,
    joined: false,
    ...overrides,
  })

describe('what the front page has to say', () => {
  it('says nothing while the answer is still being read', () => {
    expect(at({ reading: true, schools: 0, courses: 0 })).toBe('reading')
  })

  it('asks a student who has just joined to wait rather than saying they are in no school', () => {
    expect(at({ schools: 0, courses: 0, joined: true })).toBe('arriving')
  })

  it('asks anybody to wait until the school has had its chance to answer', () => {
    expect(at({ schools: 0, courses: 0, filled: false })).toBe('arriving')
  })

  it('tells a student with no school that nobody has invited them', () => {
    expect(at({ schools: 0, courses: 0 })).toBe('uninvited')
  })

  it('tells a student whose schools offer nothing apart from one who has no school', () => {
    expect(at({ schools: 1, courses: 0 })).toBe('none')
  })

  it('shows the courses as soon as there is one', () => {
    expect(at({ schools: 1, courses: 1 })).toBe('courses')
  })
})
