import { asId, type CourseId, type EnrollmentId, toIsoDateTime } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { anEnrollment, fakeDevice } from '@/shared/data/__tests__/fakeDevice'

import { findPlace } from '../model'

const COURSE = asId<CourseId>('course-1')

const asked = (id: string, at: string, overrides: Parameters<typeof anEnrollment>[0] = {}) =>
  anEnrollment({
    id: asId<EnrollmentId>(id),
    createdAt: toIsoDateTime(new Date(at)),
    ...overrides,
  })

const on = (rows: ReturnType<typeof anEnrollment>[]) => fakeDevice({ enrollments: rows }).education

describe('the request a course screen is about', () => {
  it('finds nothing where the student never asked', async () => {
    expect(await findPlace(on([]), COURSE)).toBeNull()
  })

  it('answers with the request that still holds the place', async () => {
    const live = asked('enrollment-1', '2026-01-01', { status: 'pending' })
    const older = asked('enrollment-2', '2026-03-01', { status: 'declined' })

    const found = await findPlace(on([older, live]), COURSE)

    expect(found?.id).toBe('enrollment-1')
  })

  it('answers with the last of the finished ones where none is live', async () => {
    const first = asked('enrollment-1', '2026-01-01', { status: 'declined' })
    const last = asked('enrollment-2', '2026-03-01', { status: 'declined' })

    const found = await findPlace(on([first, last]), COURSE)

    expect(found?.id).toBe('enrollment-2')
  })

  it('passes over the requests made for another course', async () => {
    const elsewhere = asked('enrollment-1', '2026-03-01', {
      status: 'declined',
      courseId: asId<CourseId>('course-2'),
    })

    expect(await findPlace(on([elsewhere]), COURSE)).toBeNull()
  })
})
