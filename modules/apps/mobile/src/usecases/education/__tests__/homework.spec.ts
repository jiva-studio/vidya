import type { BlockId, EnrollmentId, LessonVersionId, SectionId } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { fakeHttpClient } from '../../__tests__/fakeHttpClient'
import {
  listBlockStates,
  listHomeworkOfEnrollment,
  saveBlockState,
  submitHomework,
} from '../homework'

const ENROLLMENT = 'e-1' as EnrollmentId
const VERSION = 'v-1' as LessonVersionId

describe('listHomeworkOfEnrollment', () => {
  it('scopes the list to one enrolment', async () => {
    const { client, calls } = fakeHttpClient({ '/edu/homework': { items: [] } })

    await listHomeworkOfEnrollment(client, ENROLLMENT)

    expect(calls[0]).toMatchObject({ path: '/edu/homework', query: { enrollmentId: ENROLLMENT } })
  })
})

describe('submitHomework', () => {
  it('names the version answered, not the lesson', async () => {
    const { client, calls } = fakeHttpClient({ '/edu/homework': { id: 'h-1' } })

    await submitHomework(client, {
      lessonVersionId: VERSION,
      sectionId: 's-1' as SectionId,
      text: 'my answer',
    })

    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { lessonVersionId: VERSION, sectionId: 's-1', text: 'my answer' },
    })
  })
})

describe('listBlockStates', () => {
  it('leaves the version out when the caller wants every one', async () => {
    const { client, calls } = fakeHttpClient({ '/edu/progress': { items: [] } })

    await listBlockStates(client, ENROLLMENT)

    expect(calls[0].query).toMatchObject({ enrollmentId: ENROLLMENT, lessonVersionId: undefined })
  })

  it('narrows to one version when given one', async () => {
    const { client, calls } = fakeHttpClient({ '/edu/progress': { items: [] } })

    await listBlockStates(client, ENROLLMENT, VERSION)

    expect(calls[0].query).toMatchObject({ lessonVersionId: VERSION })
  })
})

describe('saveBlockState', () => {
  it('records progress against the version and the block', async () => {
    const { client, calls } = fakeHttpClient({ '/edu/progress': { id: 'b-1' } })

    await saveBlockState(client, {
      lessonVersionId: VERSION,
      blockId: 'b-1' as BlockId,
      state: { type: 'quiz', answer: 2 },
    })

    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { lessonVersionId: VERSION, blockId: 'b-1', state: { type: 'quiz', answer: 2 } },
    })
  })
})
