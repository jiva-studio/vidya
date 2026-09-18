import type { CourseId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { fakeHttpClient } from '../../__tests__/fakeHttpClient'
import { getEnrollment, listMyEnrollments, requestEnrollment } from '../enrollments'

describe('listMyEnrollments', () => {
  it('sends no student id: the API answers a student with their own rows', async () => {
    const { client, calls } = fakeHttpClient({ '/edu/enrollments': { items: [{ id: 'e-1' }] } })

    await expect(listMyEnrollments(client)).resolves.toEqual([{ id: 'e-1' }])
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/edu/enrollments' })
    expect(calls[0].query).toBeUndefined()
  })
})

describe('getEnrollment', () => {
  it('reads one enrolment by id', async () => {
    const { client, calls } = fakeHttpClient({ '/edu/enrollments/e-1': { id: 'e-1' } })

    await expect(getEnrollment(client, 'e-1' as never)).resolves.toEqual({ id: 'e-1' })
    expect(calls[0].path).toBe('/edu/enrollments/e-1')
  })
})

describe('requestEnrollment', () => {
  it('asks to join a course and returns only the new id', async () => {
    const { client, calls } = fakeHttpClient({ '/edu/enrollments': { id: 'e-9' } })

    await expect(requestEnrollment(client, 'c-1' as CourseId)).resolves.toBe('e-9')
    expect(calls[0]).toMatchObject({ method: 'POST', body: { courseId: 'c-1' } })
  })

  it('sends the course and nothing else: the school assigns the group', async () => {
    const { client, calls } = fakeHttpClient({ '/edu/enrollments': { id: 'e-9' } })

    await requestEnrollment(client, 'c-1' as CourseId)

    expect(Object.keys(calls[0].body as Record<string, unknown>)).toEqual(['courseId'])
  })
})
