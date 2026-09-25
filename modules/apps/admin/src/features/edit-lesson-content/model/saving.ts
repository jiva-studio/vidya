import type { AudioBlock, BlockId, ImageBlock, LessonBlock, VideoBlock } from '@vidya/domain'
import type { LessonContent, QuizBlock, SectionId } from '@vidya/domain'
import { LessonContentSchemaVersion } from '@vidya/domain'

type MediaBlock = ImageBlock | VideoBlock | AudioBlock

/** An unfinished block, placed by the numbers the author counts on screen. */
export interface BlockFault {
  blockId: BlockId
  sectionId: SectionId
  section: number
  position: number
}

const written = (value: string | undefined): boolean => (value ?? '').trim().length > 0

const mediaWritten = (block: MediaBlock): boolean =>
  written(block.url) || ('posterUrl' in block && written(block.posterUrl))

const quizWritten = (block: QuizBlock): boolean =>
  written(block.question) || written(block.explanation) || block.answers.some(written)

/** Whether the author has put anything at all into a block. */
const touched = (block: LessonBlock): boolean => {
  if (block.type === 'text') return written(block.content)
  if (block.type === 'quiz') return quizWritten(block)
  return mediaWritten(block)
}

const quizAnswerable = (block: QuizBlock): boolean =>
  written(block.question) &&
  block.answers.filter(written).length >= 2 &&
  written(block.answers[block.rightAnswer])

const faulty = (block: LessonBlock): boolean => {
  // A block nobody has typed into yet is not a fault, it is a blank the author
  // is standing in; saving drops it and publishing ignores it.
  if (!touched(block)) return false
  if (block.type === 'text') return false
  if (block.type === 'quiz') return !quizAnswerable(block)
  return !written(block.url)
}

/**
 * The document as it should reach the server: blanks removed, schema stamped.
 *
 * The copy on screen keeps its blanks — dropping the block the author just
 * inserted and has not yet typed into would take the caret with it — so this
 * builds a new document and never touches the one it was handed.
 */
export const pruneForSave = (content: LessonContent): LessonContent => ({
  schemaVersion: LessonContentSchemaVersion,
  sections: content.sections
    .map((section) => ({ ...section, blocks: section.blocks.filter(touched) }))
    .filter((section) => written(section.title) || section.blocks.length > 0),
})

/**
 * The blocks that are partly written but could not be answered, in reading order.
 *
 * Only publishing asks: marking a block while the author is still writing it
 * would fault every quiz between the question and its second option.
 */
export const findBlockFaults = (content: LessonContent): BlockFault[] =>
  content.sections.flatMap((section, at) =>
    section.blocks
      .map((block, position) => ({ block, position }))
      .filter((entry) => faulty(entry.block))
      .map((entry) => ({
        blockId: entry.block.id,
        sectionId: section.id,
        section: at + 1,
        position: entry.position + 1,
      })),
  )

export const findInvalidBlocks = (content: LessonContent): BlockId[] =>
  findBlockFaults(content).map((fault) => fault.blockId)
