import { describe, expect, it } from 'vitest'

import { type CourseViewInput, pickCourseView, pickLessonsView } from '../model'

const input = (overrides: Partial<CourseViewInput> = {}): CourseViewInput => ({
  reading: false,
  found: true,
  filled: true,
  ...overrides,
})

describe('what a course screen has to say', () => {
  it('says it is reading before the database has answered', () => {
    expect(pickCourseView(input({ reading: true, found: false }))).toBe('reading')
  })

  it('promises the course is coming while no run has finished here', () => {
    expect(pickCourseView(input({ found: false, filled: false }))).toBe('arriving')
  })

  it('says the course is not on this machine once a run has finished', () => {
    expect(pickCourseView(input({ found: false }))).toBe('absent')
  })

  it('shows the course whenever it is here', () => {
    expect(pickCourseView(input({ filled: false }))).toBe('course')
  })
})

describe('what the lesson list of a course has to say', () => {
  it('does not call a course empty while its lessons may still be coming', () => {
    expect(pickLessonsView({ lessons: 0, filled: false })).toBe('arriving')
  })

  it('says the course has no lessons once a run has finished and found none', () => {
    expect(pickLessonsView({ lessons: 0, filled: true })).toBe('empty')
  })

  it('lists the lessons as soon as there are any', () => {
    expect(pickLessonsView({ lessons: 2, filled: false })).toBe('lessons')
  })
})
