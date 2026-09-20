import type { BlockId, LessonContent, LessonSection, SectionId } from '@vidya/domain'
import { LessonContentSchemaVersion } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { insertBlockAfter, removeBlock, reorderBlocks, reorderSections } from '../model'

const section = (id: string, ...blocks: string[]): LessonSection =>
  ({
    id: id as unknown as SectionId,
    title: id,
    assessment: 'none',
    blocks: blocks.map((blockId) => ({
      id: blockId as unknown as BlockId,
      type: 'text',
      content: blockId,
    })),
  }) as LessonSection

const document = (): LessonContent => ({
  schemaVersion: LessonContentSchemaVersion,
  sections: [section('s1', 'b1', 'b2', 'b3'), section('s2', 'b4', 'b5')],
})

const blockIds = (content: LessonContent, at = 0) =>
  content.sections[at].blocks.map((block) => block.id as string)

const sectionIds = (content: LessonContent) => content.sections.map((item) => item.id as string)

const everyId = (content: LessonContent): string[] =>
  content.sections.flatMap((item) => [
    item.id as string,
    ...item.blocks.map((block) => block.id as string),
  ])

describe('moving blocks within a section', () => {
  it('drops a block at the position it was dragged to', () => {
    const moved = reorderBlocks(document(), 's1' as unknown as SectionId, 0, 2)

    expect(blockIds(moved)).toEqual(['b2', 'b3', 'b1'])
  })

  it('moves a block backwards as readily as forwards', () => {
    const moved = reorderBlocks(document(), 's1' as unknown as SectionId, 2, 0)

    expect(blockIds(moved)).toEqual(['b3', 'b1', 'b2'])
  })

  it('leaves the document alone when the drop lands nowhere', () => {
    const before = document()

    expect(blockIds(reorderBlocks(before, 's1' as unknown as SectionId, 0, -1))).toEqual([
      'b1',
      'b2',
      'b3',
    ])
    expect(blockIds(reorderBlocks(before, 's1' as unknown as SectionId, 0, 9))).toEqual([
      'b1',
      'b2',
      'b3',
    ])
    expect(blockIds(reorderBlocks(before, 'missing' as unknown as SectionId, 0, 1))).toEqual([
      'b1',
      'b2',
      'b3',
    ])
  })

  it('touches no other section', () => {
    const moved = reorderBlocks(document(), 's1' as unknown as SectionId, 0, 2)

    expect(blockIds(moved, 1)).toEqual(['b4', 'b5'])
  })
})

describe('moving sections', () => {
  it('drops a section at the position it was dragged to', () => {
    expect(sectionIds(reorderSections(document(), 1, 0))).toEqual(['s2', 's1'])
  })

  it('carries the blocks of the section it moved', () => {
    const moved = reorderSections(document(), 1, 0)

    expect(blockIds(moved, 0)).toEqual(['b4', 'b5'])
    expect(blockIds(moved, 1)).toEqual(['b1', 'b2', 'b3'])
  })
})

describe('inserting a block', () => {
  it('puts the new block directly below the one the author was in', () => {
    const next = insertBlockAfter(
      document(),
      's1' as unknown as SectionId,
      'b1' as unknown as BlockId,
      'image',
    )

    expect(blockIds(next)).toEqual(['b1', next.sections[0].blocks[1].id as string, 'b2', 'b3'])
    expect(next.sections[0].blocks[1].type).toBe('image')
  })

  it('appends when the section has no blocks to insert below', () => {
    const empty: LessonContent = {
      schemaVersion: LessonContentSchemaVersion,
      sections: [section('s1')],
    }

    const next = insertBlockAfter(empty, 's1' as unknown as SectionId, undefined, 'text')

    expect(next.sections[0].blocks).toHaveLength(1)
  })

  it('stamps the schema version this build writes', () => {
    const stale = { ...document(), schemaVersion: 0 }

    expect(
      insertBlockAfter(stale, 's1' as unknown as SectionId, 'b1' as unknown as BlockId, 'text')
        .schemaVersion,
    ).toBe(LessonContentSchemaVersion)
  })
})

describe('identity through a run of edits', () => {
  it('leaves every surviving identifier untouched', () => {
    const before = document()
    const survivors = everyId(before).filter((id) => id !== 'b2')

    let content = reorderBlocks(before, 's1' as unknown as SectionId, 0, 2)
    content = insertBlockAfter(
      content,
      's1' as unknown as SectionId,
      'b3' as unknown as BlockId,
      'quiz',
    )
    content = removeBlock(content, 's1' as unknown as SectionId, 'b2' as unknown as BlockId)
    content = reorderSections(content, 0, 1)

    expect(everyId(content)).toEqual(expect.arrayContaining(survivors))
    expect(everyId(content).filter((id) => survivors.includes(id))).toHaveLength(survivors.length)
  })

  it('moves the objects that carry the identifiers rather than rebuilding them', () => {
    const before = document()
    const first = before.sections[0].blocks[0]

    const moved = reorderBlocks(before, 's1' as unknown as SectionId, 0, 2)

    expect(moved.sections[0].blocks[2]).toBe(first)
  })
})
