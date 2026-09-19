import type { LessonId, LessonVersionId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import type { LessonVersionSummary } from '@vidya/protocol'
import { describe, expect, it } from 'vitest'

import { draftVersionOf, lessonVersionState, publishedVersionOf } from '../model'

const LESSON = asId<LessonId>('33333333-3333-3333-3333-333333333333')

const version = (number: number, status: LessonVersionSummary['status']): LessonVersionSummary => ({
  id: asId<LessonVersionId>(`0000000${number}-0000-0000-0000-000000000000`),
  lessonId: LESSON,
  version: number,
  status,
})

describe('lessonVersionState', () => {
  it('is a draft while the lesson has never been published', () => {
    expect(lessonVersionState([version(1, 'draft')])).toBe('draft')
  })

  it('is published once the only version is live', () => {
    expect(lessonVersionState([version(1, 'published')])).toBe('published')
  })

  it('is a revision when a draft is open over published content', () => {
    expect(lessonVersionState([version(1, 'published'), version(2, 'draft')])).toBe('revising')
  })

  it('claims nothing when no version has been read', () => {
    expect(lessonVersionState([])).toBeUndefined()
  })

  it('names the newest published version, not the first', () => {
    const versions = [version(1, 'published'), version(3, 'published'), version(2, 'published')]

    expect(publishedVersionOf(versions)).toBe(3)
  })

  it('names the one open draft, which the server allows only one of', () => {
    expect(draftVersionOf([version(1, 'published'), version(2, 'draft')])).toBe(2)
  })

  it('leaves the list it was given alone', () => {
    const versions = [version(2, 'published'), version(1, 'published')]

    publishedVersionOf(versions)

    expect(versions.map((item) => item.version)).toEqual([2, 1])
  })
})
