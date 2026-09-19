import type { CourseId, SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { fakeHttpClient } from '@/shared/testing'

import { createCourse, getCourse, getCourses, updateCourse } from '../api'

const SCHOOL = asId<SchoolId>('11111111-1111-1111-1111-111111111111')
const COURSE = asId<CourseId>('22222222-2222-2222-2222-222222222222')

const COURSES = '/edu/courses'

const values = {
  name: 'Sanskrit grammar',
  description: 'Cases and verbs',
  learningType: 'group' as const,
}

const transport = () =>
  fakeHttpClient({ [COURSES]: { items: [] }, [`${COURSES}/`]: { id: COURSE } })

describe('course requests', () => {
  it('asks for the courses of the school it was given', async () => {
    const fake = transport()

    await getCourses(fake.client, { schoolId: SCHOOL })

    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: COURSES,
      query: { schoolId: SCHOOL },
    })
  })

  it('leaves the school out when there is none, rather than sending undefined text', async () => {
    const fake = transport()

    await getCourses(fake.client, {})

    expect(fake.calls[0].query).toEqual({ schoolId: undefined })
  })

  it('reads one course by its id', async () => {
    const fake = transport()

    await getCourse(fake.client, COURSE)

    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: `${COURSES}/${COURSE}` })
  })

  it('creates a course with exactly the fields the schema has', async () => {
    const fake = transport()

    await createCourse(fake.client, SCHOOL, values)

    const call = fake.calls[0]
    expect(call).toMatchObject({ method: 'POST', path: COURSES })
    expect(Object.keys(call.body as Record<string, unknown>).sort()).toEqual([
      'description',
      'learningType',
      'name',
      'schoolId',
    ])
  })

  it('never sends a cover or a subtitle, whatever the archive showed', async () => {
    const fake = transport()

    await createCourse(fake.client, SCHOOL, values)

    const body = fake.calls[0].body as Record<string, unknown>
    expect(body.coverImageUrl).toBeUndefined()
    expect(body.subtitle).toBeUndefined()
  })

  it('updates a course without touching the school it belongs to', async () => {
    const fake = transport()

    await updateCourse(fake.client, COURSE, values)

    const call = fake.calls[0]
    expect(call).toMatchObject({ method: 'PATCH', path: `${COURSES}/${COURSE}` })
    expect(Object.keys(call.body as Record<string, unknown>).sort()).toEqual([
      'description',
      'learningType',
      'name',
    ])
  })
})
