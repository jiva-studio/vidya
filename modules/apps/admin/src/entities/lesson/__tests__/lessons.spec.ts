import type { CourseId, LessonId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { fakeHttpClient } from '@/shared/testing'

import { createLesson, getLesson, getLessons, getLessonVersions } from '../api'

const COURSE = asId<CourseId>('22222222-2222-2222-2222-222222222222')
const LESSON = asId<LessonId>('33333333-3333-3333-3333-333333333333')

const LESSONS = '/edu/lessons'

const transport = () => fakeHttpClient({ [LESSONS]: { items: [] } })

describe('lesson requests', () => {
  it('asks for the lessons of one course', async () => {
    const fake = transport()

    await getLessons(fake.client, { courseId: COURSE })

    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: LESSONS,
      query: { courseId: COURSE },
    })
  })

  it('reads one lesson by its id', async () => {
    const fake = transport()

    await getLesson(fake.client, LESSON)

    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: `${LESSONS}/${LESSON}` })
  })

  it('reads the versions of a lesson through the lesson that owns them', async () => {
    const fake = transport()

    await getLessonVersions(fake.client, LESSON)

    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `${LESSONS}/${LESSON}/versions`,
    })
  })

  it('creates a lesson with the course, the number and the title, and nothing else', async () => {
    const fake = transport()

    await createLesson(fake.client, COURSE, 4, 'Sandhi')

    const call = fake.calls[0]
    expect(call).toMatchObject({ method: 'POST', path: LESSONS })
    expect(call.body).toEqual({ courseId: COURSE, lessonNumber: 4, title: 'Sandhi' })
  })
})
