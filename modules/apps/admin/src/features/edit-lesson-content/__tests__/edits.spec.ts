import type { LessonContent, QuizBlock, TextBlock } from '@vidya/domain'
import { emptyLessonContent, LessonContentSchemaVersion } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import {
  addBlock,
  addSection,
  moveBlock,
  moveSection,
  removeBlock,
  removeSection,
  renameSection,
  setSectionAssessment,
  updateBlock,
} from '../model'

const titlesOf = (content: LessonContent) => content.sections.map((section) => section.title)

const idsOf = (content: LessonContent): string[] => [
  ...content.sections.map((section) => section.id as string),
  ...content.sections.flatMap((section) => section.blocks.map((block) => block.id as string)),
]

const withSections = (...titles: string[]): LessonContent =>
  titles.reduce((content, title) => addSection(content, title), emptyLessonContent())

describe('sections', () => {
  it('adds a section with a fresh identifier and no blocks', () => {
    const content = addSection(emptyLessonContent(), 'Alphabet')

    expect(content.sections).toHaveLength(1)
    expect(content.sections[0].title).toBe('Alphabet')
    expect(content.sections[0].blocks).toEqual([])
    expect(content.sections[0].assessment).toBe('none')
    expect(content.sections[0].id).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('stamps the schema version this build writes', () => {
    const content = addSection({ schemaVersion: 0, sections: [] }, 'Alphabet')

    expect(content.schemaVersion).toBe(LessonContentSchemaVersion)
  })

  it('renames, reassesses and removes by identifier', () => {
    const content = withSections('One', 'Two')
    const [first, second] = content.sections

    expect(titlesOf(renameSection(content, first.id, 'Renamed'))).toEqual(['Renamed', 'Two'])
    expect(setSectionAssessment(content, second.id, 'teacher').sections[1].assessment).toBe(
      'teacher',
    )
    expect(titlesOf(removeSection(content, first.id))).toEqual(['Two'])
  })

  it('moves a section past its neighbour and stops at either end', () => {
    const content = withSections('One', 'Two', 'Three')
    const [first, , third] = content.sections

    expect(titlesOf(moveSection(content, first.id, 1))).toEqual(['Two', 'One', 'Three'])
    expect(titlesOf(moveSection(content, first.id, -1))).toEqual(['One', 'Two', 'Three'])
    expect(titlesOf(moveSection(content, third.id, 1))).toEqual(['One', 'Two', 'Three'])
  })
})

describe('blocks', () => {
  it('adds each kind with its own blank shape', () => {
    let content = withSections('One')
    const section = content.sections[0].id

    for (const type of ['text', 'video', 'audio', 'quiz'] as const) {
      content = addBlock(content, section, type)
    }

    expect(content.sections[0].blocks.map((block) => block.type)).toEqual([
      'text',
      'video',
      'audio',
      'quiz',
    ])

    const quiz = content.sections[0].blocks[3] as QuizBlock
    expect(quiz.answers).toHaveLength(2)
    expect(quiz.rightAnswer).toBe(0)
  })

  it('updates, moves and removes a block by identifier', () => {
    const base = withSections('One')
    const section = base.sections[0].id
    const content = addBlock(addBlock(base, section, 'text'), section, 'quiz')

    const [text, quiz] = content.sections[0].blocks

    const written = updateBlock(content, section, {
      ...(text as TextBlock),
      content: 'Hello',
    })
    expect((written.sections[0].blocks[0] as TextBlock).content).toBe('Hello')

    const moved = moveBlock(content, section, quiz.id, -1)
    expect(moved.sections[0].blocks.map((block) => block.id)).toEqual([quiz.id, text.id])

    expect(removeBlock(content, section, text.id).sections[0].blocks).toHaveLength(1)
  })
})

describe('identity', () => {
  it('keeps the same set of identifiers through a long series of edits', () => {
    let content = withSections('One', 'Two', 'Three')

    for (const section of content.sections) {
      content = addBlock(content, section.id, 'text')
      content = addBlock(content, section.id, 'quiz')
    }

    const before = idsOf(content)
    expect(new Set(before).size).toBe(before.length)

    // A run longer than any editing session: every reorder, rename and block
    // edit an operator can reach, over and over, against the same document.
    for (let round = 0; round < 40; round += 1) {
      const sections = content.sections
      const section = sections[round % sections.length]

      content = renameSection(content, section.id, `Round ${round}`)
      content = setSectionAssessment(content, section.id, round % 2 ? 'teacher' : 'none')
      content = moveSection(content, section.id, round % 2 ? 1 : -1)

      const blocks = content.sections[round % content.sections.length].blocks
      const target = blocks[round % blocks.length]
      const owner = content.sections[round % content.sections.length].id

      content = moveBlock(content, owner, target.id, round % 2 ? 1 : -1)
      if (target.type === 'text') {
        content = updateBlock(content, owner, { ...target, content: `text ${round}` })
      }
    }

    expect(idsOf(content).sort()).toEqual([...before].sort())
  })

  it('never reuses an identifier that a deletion freed', () => {
    const content = withSections('One')
    const removed = content.sections[0].id
    const minted = new Set<string>()

    let next = removeSection(content, removed)
    for (let round = 0; round < 50; round += 1) {
      next = addSection(next, `Section ${round}`)
      minted.add(next.sections[next.sections.length - 1].id as string)
    }

    expect(minted.has(removed as string)).toBe(false)
    expect(minted.size).toBe(50)
  })
})
