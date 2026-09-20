import type { BlockId, LessonBlock, LessonContent, LessonSection, SectionId } from '@vidya/domain'
import { LessonContentSchemaVersion } from '@vidya/domain'

import type { BlockType, MoveDirection } from '../types'
import { createBlock, newBlockId, newSectionId } from './blocks'

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

/**
 * Lifts an element out and drops it back in at `to`, or copies the list when
 * either end of the move is outside it.
 *
 * A drag that ends over nothing reports a target no list position answers to,
 * and the document has to survive that untouched rather than wrap the index.
 */
const moved = <TItem>(items: readonly TItem[], from: number, to: number): TItem[] => {
  const next = [...items]
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return next

  const [carried] = next.splice(from, 1)
  next.splice(to, 0, carried)
  return next
}

/** Where a block inserted "below this one" lands, and the end when there is no one. */
const below = (blocks: readonly LessonBlock[], blockId: BlockId | undefined): number => {
  const at = blocks.findIndex((block) => block.id === blockId)
  return at < 0 ? blocks.length : at + 1
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

/** Opens a section directly below `afterId`, or at the end when there is none. */
export const insertSectionAfter = (
  content: LessonContent,
  afterId: SectionId | undefined,
): LessonContent => {
  const next = [...content.sections]
  const at = next.findIndex((section) => section.id === afterId)

  next.splice(at < 0 ? next.length : at + 1, 0, {
    id: newSectionId(),
    title: '',
    blocks: [],
    assessment: 'none',
  })
  return stamped(next)
}

/** The id the section opened below `afterId` was given, for the caret to follow. */
export const sectionBelow = (
  content: LessonContent,
  afterId: SectionId | undefined,
): SectionId | undefined => {
  const at = content.sections.findIndex((section) => section.id === afterId)
  return at < 0 ? content.sections[content.sections.length - 1]?.id : content.sections[at + 1]?.id
}

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

export const reorderSections = (content: LessonContent, from: number, to: number): LessonContent =>
  stamped(moved(content.sections, from, to))

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

/**
 * Puts a fresh block of `type` directly below `afterId`.
 *
 * The author's attention is on the block they were in, so a new one appears
 * under it rather than at the end of a section they may have scrolled away from.
 */
export const insertBlockAfter = (
  content: LessonContent,
  sectionId: SectionId,
  afterId: BlockId | undefined,
  type: BlockType,
): LessonContent =>
  withBlocks(content, sectionId, (blocks) => {
    const next = [...blocks]
    next.splice(below(blocks, afterId), 0, createBlock(type))
    return next
  })

/**
 * Ends a text block at the caret and opens the rest as the block below it.
 *
 * Enter is how a document grows a paragraph, so it grows a block: the text the
 * caret was in front of goes with it rather than being left behind above.
 */
export const splitTextBlock = (
  content: LessonContent,
  sectionId: SectionId,
  blockId: BlockId,
  head: string,
  tail: string,
): LessonContent =>
  withBlocks(content, sectionId, (blocks) => {
    const source = blocks.find((block) => block.id === blockId)
    if (!source || source.type !== 'text') return [...blocks]

    const next = blocks.map((block) => (block.id === blockId ? { ...source, content: head } : block))
    next.splice(below(blocks, blockId), 0, { id: newBlockId(), type: 'text', content: tail })
    return next
  })

/** The id the block inserted below `afterId` was given, for the caret to follow. */
export const blockBelow = (
  content: LessonContent,
  sectionId: SectionId,
  afterId: BlockId | undefined,
): BlockId | undefined => {
  const blocks = content.sections.find((section) => section.id === sectionId)?.blocks ?? []
  const at = blocks.findIndex((block) => block.id === afterId)

  return at < 0 ? blocks[blocks.length - 1]?.id : blocks[at + 1]?.id
}

/**
 * Turns a block into one of another kind, in its place and under its own id.
 *
 * Asking for a picture from the line you are standing on is asking for that
 * line to become one: a second block below would leave the empty line behind
 * and put the caret somewhere the author did not point at.
 */
export const convertBlock = (
  content: LessonContent,
  sectionId: SectionId,
  blockId: BlockId,
  type: BlockType,
): LessonContent =>
  withBlocks(content, sectionId, (blocks) =>
    blocks.map((block) => (block.id === blockId ? { ...createBlock(type), id: blockId } : block)),
  )

/** A copy of the block, carrying its content but never its identity. */
export const duplicateBlock = (
  content: LessonContent,
  sectionId: SectionId,
  blockId: BlockId,
): LessonContent =>
  withBlocks(content, sectionId, (blocks) => {
    const source = blocks.find((block) => block.id === blockId)
    if (!source) return [...blocks]

    const next = [...blocks]
    next.splice(below(blocks, blockId), 0, { ...source, id: newBlockId() })
    return next
  })

export const reorderBlocks = (
  content: LessonContent,
  sectionId: SectionId,
  from: number,
  to: number,
): LessonContent => withBlocks(content, sectionId, (blocks) => moved(blocks, from, to))

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
