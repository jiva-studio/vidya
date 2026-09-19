import type { BlockId, LessonBlock, LessonContent, LessonSection, SectionId } from '@vidya/domain'
import { LessonContentSchemaVersion } from '@vidya/domain'

import type { BlockType, MoveDirection } from '../types'
import { createBlock, newSectionId } from './blocks'

/**
 * Every edit returns a new document, stamped with the schema this build writes.
 *
 * Replacing rather than mutating is what makes the identity rule checkable: the
 * objects that carry the ids are moved between arrays, never rebuilt, so a test
 * can compare the set of ids before and after a run of edits.
 */
const stamped = (sections: LessonSection[]): LessonContent => ({
  schemaVersion: LessonContentSchemaVersion,
  sections,
})

/** Swaps an element with its neighbour, and does nothing at either end. */
const swapped = <TItem>(items: readonly TItem[], index: number, delta: MoveDirection): TItem[] => {
  const target = index + delta
  if (index < 0 || target < 0 || target >= items.length) return [...items]

  const next = [...items]
  next[index] = items[target]
  next[target] = items[index]
  return next
}

const withSection = (
  content: LessonContent,
  sectionId: SectionId,
  change: (section: LessonSection) => LessonSection,
): LessonContent =>
  stamped(content.sections.map((section) => (section.id === sectionId ? change(section) : section)))

const withBlocks = (
  content: LessonContent,
  sectionId: SectionId,
  change: (blocks: LessonBlock[]) => LessonBlock[],
): LessonContent =>
  withSection(content, sectionId, (section) => ({ ...section, blocks: change(section.blocks) }))

/* --------------------------------- Sections -------------------------------- */

export const addSection = (content: LessonContent, title: string): LessonContent =>
  stamped([...content.sections, { id: newSectionId(), title, blocks: [], assessment: 'none' }])

export const renameSection = (
  content: LessonContent,
  sectionId: SectionId,
  title: string,
): LessonContent => withSection(content, sectionId, (section) => ({ ...section, title }))

export const setSectionAssessment = (
  content: LessonContent,
  sectionId: SectionId,
  assessment: LessonSection['assessment'],
): LessonContent => withSection(content, sectionId, (section) => ({ ...section, assessment }))

export const removeSection = (content: LessonContent, sectionId: SectionId): LessonContent =>
  stamped(content.sections.filter((section) => section.id !== sectionId))

export const moveSection = (
  content: LessonContent,
  sectionId: SectionId,
  delta: MoveDirection,
): LessonContent =>
  stamped(
    swapped(
      content.sections,
      content.sections.findIndex((section) => section.id === sectionId),
      delta,
    ),
  )

/* ---------------------------------- Blocks --------------------------------- */

export const addBlock = (
  content: LessonContent,
  sectionId: SectionId,
  type: BlockType,
): LessonContent => withBlocks(content, sectionId, (blocks) => [...blocks, createBlock(type)])

export const updateBlock = (
  content: LessonContent,
  sectionId: SectionId,
  block: LessonBlock,
): LessonContent =>
  withBlocks(content, sectionId, (blocks) =>
    blocks.map((current) => (current.id === block.id ? block : current)),
  )

export const removeBlock = (
  content: LessonContent,
  sectionId: SectionId,
  blockId: BlockId,
): LessonContent =>
  withBlocks(content, sectionId, (blocks) => blocks.filter((block) => block.id !== blockId))

export const moveBlock = (
  content: LessonContent,
  sectionId: SectionId,
  blockId: BlockId,
  delta: MoveDirection,
): LessonContent =>
  withBlocks(content, sectionId, (blocks) =>
    swapped(
      blocks,
      blocks.findIndex((block) => block.id === blockId),
      delta,
    ),
  )
