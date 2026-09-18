import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { routes } from '../routes'

const router = createRouter({ history: createMemoryHistory(), routes })

/**
 * Every navigation the education screens perform, resolved against the route it
 * aims at.
 *
 * A forgotten parameter passes both the build and the type check and then
 * throws when the button is pressed, so the only place it can be caught is
 * here. The table mirrors the `router.push` calls in the pages one for one.
 */
describe('education routes', () => {
  it.each([
    [
      'the catalogue opening a course',
      { name: 'course', params: { id: 'c-1' } },
      '/education/courses/c-1',
    ],
    [
      'a course starting an enrolment',
      { name: 'enroll', params: { id: 'c-1' } },
      '/education/courses/c-1/enroll',
    ],
    [
      'a sent request showing the confirmation',
      { name: 'enroll-completed', params: { id: 'c-1' } },
      '/education/courses/c-1/enroll/completed',
    ],
    [
      'my courses opening one enrolment',
      { name: 'my-enrollment', params: { id: 'e-1' } },
      '/education/my-enrollments/e-1',
    ],
    [
      'an enrolment opening a lesson',
      { name: 'lesson', params: { enrollmentId: 'e-1', lessonId: 'l-1' } },
      '/education/my-enrollments/e-1/lessons/l-1',
    ],
  ])('resolves %s', (_case, target, expected) => {
    expect(router.resolve(target).path).toBe(expected)
  })

  it('refuses a lesson that does not say which enrolment it belongs to', () => {
    expect(() => router.resolve({ name: 'lesson', params: { lessonId: 'l-1' } })).toThrow(
      /enrollmentId/,
    )
  })
})
