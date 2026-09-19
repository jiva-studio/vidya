import type { LessonId, LessonVersionId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import type { LessonVersionSummary } from '@vidya/protocol'
import { describe, expect, it } from 'vitest'

import { HttpError, OfflineError } from '@/shared/api'

import { isDraftConflict, openDraftOf, versionToOpen } from '../model'

const version = (n: number, status: LessonVersionSummary['status']): LessonVersionSummary => ({
  id: asId<LessonVersionId>(`v${n}`),
  lessonId: asId<LessonId>('l1'),
  version: n,
  status,
})

describe('versionToOpen', () => {
  it('opens the draft a lesson was born with rather than creating one', () => {
    expect(versionToOpen([version(1, 'draft')])?.id).toBe('v1')
  })

  it('opens the draft in progress over the published text', () => {
    expect(versionToOpen([version(1, 'published'), version(2, 'draft')])?.id).toBe('v2')
  })

  it('opens the newest published version when nothing is being written', () => {
    expect(versionToOpen([version(1, 'published'), version(2, 'published')])?.id).toBe('v2')
  })

  it('opens nothing when the versions are not known', () => {
    expect(versionToOpen([])).toBeUndefined()
    expect(openDraftOf([version(1, 'published')])).toBeUndefined()
  })
})

describe('isDraftConflict', () => {
  it('reads a 409 as the draft that already exists', () => {
    expect(isDraftConflict(new HttpError(409, '/edu/lessons/l1/versions'))).toBe(true)
  })

  it('leaves every other failure a failure', () => {
    expect(isDraftConflict(new HttpError(403, '/edu/lessons/l1/versions'))).toBe(false)
    expect(isDraftConflict(new OfflineError('/edu/lessons/l1/versions'))).toBe(false)
    expect(isDraftConflict(undefined)).toBe(false)
  })
})
