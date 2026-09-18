import type { BlockId, LessonBlock, LessonContent, SectionId } from '@vidya/domain'
import { asId, LessonContentSchemaVersion } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { contentProblems, isKnownBlockType } from '../model'

const contentWith = (blocks: LessonBlock[], schemaVersion = LessonContentSchemaVersion) =>
  ({
    schemaVersion,
    sections: [{ id: asId<SectionId>('s1'), title: 'One', blocks, assessment: 'none' }],
  }) satisfies LessonContent

const alien = { id: asId<BlockId>('b9'), type: 'hologram' } as unknown as LessonBlock

describe('contentProblems', () => {
  it('finds nothing wrong with a document this build wrote', () => {
    expect(
      contentProblems(contentWith([{ id: asId<BlockId>('b1'), type: 'text', content: '' }])),
    ).toEqual([])
  })

  it('reports a block kind it cannot author instead of dropping it', () => {
    expect(contentProblems(contentWith([alien]))).toEqual([
      { kind: 'unknown-block', detail: 'hologram' },
    ])
  })

  it('reports a document written by a newer build', () => {
    expect(contentProblems(contentWith([], LessonContentSchemaVersion + 1))).toEqual([
      { kind: 'schema-version', detail: String(LessonContentSchemaVersion + 1) },
    ])
  })

  it('accepts an older schema, which this build can still read', () => {
    expect(contentProblems(contentWith([], 0))).toEqual([])
  })

  it('knows the four kinds it can author', () => {
    expect(['text', 'video', 'audio', 'quiz'].every(isKnownBlockType)).toBe(true)
    expect(isKnownBlockType('hologram')).toBe(false)
  })
})
