import type { LocalHomework, SaveHomeworkAnswer } from '@vidya/client'
import { asId, type HomeworkId, type IsoDateTime, toIsoDateTime } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSyncRuns } from '@/shared/sync'

import { useHomeworkWriter } from '../useHomeworkWriter'

const anAnswer = (over: Partial<LocalHomework> = {}): LocalHomework => ({
  id: asId<HomeworkId>('homework-1'),
  schoolId: asId('school-1'),
  enrollmentId: asId('enrollment-1'),
  lessonVersionId: asId('version-1'),
  sectionId: asId('section-1'),
  status: 'open',
  text: 'answer text',
  grade: null,
  comment: null,
  createdAt: toIsoDateTime(new Date('2026-01-01T00:00:00.000Z')),
  submittedAt: null,
  updatedAt: toIsoDateTime(new Date('2026-01-01T00:00:00.000Z')),
  ...over,
})

describe('useHomeworkWriter', () => {
  beforeEach(() => {
    const hw = useHomeworkWriter()
    hw.adoptWriter(undefined)
    hw.adoptClock(undefined)
    useSyncRuns().adoptRunner(undefined)
  })

  it('reports unwritable when no writer is adopted', async () => {
    const hw = useHomeworkWriter()
    expect(hw.writable.value).toBe(false)

    const result = await hw.saveAnswer({} as SaveHomeworkAnswer)
    expect(result).toBe('unwritable')

    const submitResult = await hw.submitAnswer(asId<HomeworkId>('hw-1'))
    expect(submitResult).toBe('unwritable')
  })

  it('uses injected clock timestamp when submitting without an explicit date', async () => {
    const hw = useHomeworkWriter()
    const submit = vi.fn(async (id: HomeworkId, at: IsoDateTime) =>
      anAnswer({ id, status: 'pending', submittedAt: at }),
    )
    hw.adoptWriter({ saveAnswer: vi.fn(), submit })
    const pinnedTime = toIsoDateTime(new Date('2026-05-10T12:00:00.000Z'))
    hw.adoptClock(() => pinnedTime)

    const outcome = await hw.submitAnswer(asId<HomeworkId>('homework-42'))

    expect(outcome).toBe('written')
    expect(submit).toHaveBeenCalledWith('homework-42', pinnedTime)
  })

  it('requests a sync run upon successful submission', async () => {
    const hw = useHomeworkWriter()
    const submit = vi.fn(async (id: HomeworkId, at: IsoDateTime) =>
      anAnswer({ id, status: 'pending', submittedAt: at }),
    )
    const run = vi.fn()
    useSyncRuns().adoptRunner(run)
    hw.adoptWriter({ saveAnswer: vi.fn(), submit })

    await hw.submitAnswer(asId<HomeworkId>('homework-1'))

    expect(run).toHaveBeenCalledTimes(1)
  })
})
