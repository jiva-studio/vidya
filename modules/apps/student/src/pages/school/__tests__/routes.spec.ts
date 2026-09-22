import { describe, expect, it } from 'vitest'

import { routes } from '../routes'

describe("the addresses of one school's screens", () => {
  it('names every one of them by the school code and never by an identifier', () => {
    expect(routes.map((route) => route.path)).toEqual([
      '/s/:code',
      '/s/:code/c/:courseId',
      '/s/:code/c/:courseId/enroll',
      '/s/:code/c/:courseId/place',
      '/s/:code/c/:courseId/l/:lessonId',
    ])
  })
})
