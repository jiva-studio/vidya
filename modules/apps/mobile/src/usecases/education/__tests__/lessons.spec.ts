import type { LessonId, LessonVersionId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { fakeHttpClient } from '../../__tests__/fakeHttpClient'
import { getPublishedLessonVersion, listLessonsOfCourse } from '../lessons'

const LESSON = 'l-1' as LessonId
const versionsPath = `/edu/lessons/${LESSON}/versions`
const version = (id: string, n: number, status: 'draft' | 'published') => ({
  id: id as LessonVersionId,
  lessonId: LESSON,
  version: n,
  status,
})

describe('listLessonsOfCourse', () => {
  it('asks for one course and unwraps the envelope', async () => {
    const { client, calls } = fakeHttpClient({ '/edu/lessons': { items: [{ id: 'l-1' }] } })

    await expect(listLessonsOfCourse(client, 'c-1' as never)).resolves.toEqual([{ id: 'l-1' }])
    expect(calls[0]).toMatchObject({ path: '/edu/lessons', query: { courseId: 'c-1' } })
  })
})

describe('getPublishedLessonVersion', () => {
  it('reads the published version and never a draft', async () => {
    const { client, calls } = fakeHttpClient({
      [`${versionsPath}/v-2`]: { ...version('v-2', 2, 'published'), content: { sections: [] } },
      [versionsPath]: { items: [version('v-2', 2, 'published'), version('v-3', 3, 'draft')] },
    })

    const result = await getPublishedLessonVersion(client, LESSON)

    expect(result?.id).toBe('v-2')
    expect(calls.map((c) => c.path)).toEqual([versionsPath, `${versionsPath}/v-2`])
  })

  it('takes the newest published version when several exist', async () => {
    const { client } = fakeHttpClient({
      [`${versionsPath}/v-5`]: { ...version('v-5', 5, 'published'), content: { sections: [] } },
      [versionsPath]: {
        items: [
          version('v-1', 1, 'published'),
          version('v-5', 5, 'published'),
          version('v-3', 3, 'published'),
        ],
      },
    })

    await expect(getPublishedLessonVersion(client, LESSON)).resolves.toMatchObject({ id: 'v-5' })
  })

  it('answers with nothing when the lesson has never been published', async () => {
    const { client, calls } = fakeHttpClient({
      [versionsPath]: { items: [version('v-1', 1, 'draft')] },
    })

    await expect(getPublishedLessonVersion(client, LESSON)).resolves.toBeUndefined()
    expect(calls).toHaveLength(1)
  })

  it('answers with nothing when the lesson has no versions at all', async () => {
    const { client } = fakeHttpClient({ [versionsPath]: { items: [] } })

    await expect(getPublishedLessonVersion(client, LESSON)).resolves.toBeUndefined()
  })
})
