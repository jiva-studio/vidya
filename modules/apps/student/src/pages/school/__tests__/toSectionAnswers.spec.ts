import { asId, type HomeworkId, type SectionId, toIsoDateTime } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { anAnswer } from '@/shared/data/__tests__/fakeDevice'

import { toSectionAnswers } from '../model'

const on = (section: string, id: string, createdAt: string) =>
  anAnswer({
    id: asId<HomeworkId>(id),
    sectionId: asId<SectionId>(section),
    createdAt: toIsoDateTime(new Date(createdAt)),
  })

describe('toSectionAnswers', () => {
  it('keys the answer by the section it was written on', () => {
    const rows = [
      on('section-1', 'homework-1', '2026-01-01T00:00:00.000Z'),
      on('section-2', 'homework-2', '2026-01-01T00:00:00.000Z'),
    ]

    expect(Object.keys(toSectionAnswers(rows))).toEqual(['section-1', 'section-2'])
  })

  it('keeps the later of two answers to one section, whatever order they arrive in', () => {
    const rows = [
      on('section-1', 'homework-late', '2026-02-01T00:00:00.000Z'),
      on('section-1', 'homework-early', '2026-01-01T00:00:00.000Z'),
    ]

    expect(toSectionAnswers(rows)['section-1' as SectionId]?.id).toBe('homework-late')
  })

  it('answers with nothing for a lesson nobody has written on', () => {
    expect(toSectionAnswers([])).toEqual({})
  })

  it('keeps the later answer when multiple answers have the same timestamp', () => {
    const rows = [
      on('section-1', 'homework-first', '2026-01-01T00:00:00.000Z'),
      on('section-1', 'homework-second', '2026-01-01T00:00:00.000Z'),
    ]

    expect(toSectionAnswers(rows)['section-1' as SectionId]?.id).toBe('homework-second')
  })
})
