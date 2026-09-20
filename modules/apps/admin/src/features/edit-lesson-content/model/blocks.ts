import type { BlockId, LessonBlock, SectionId } from '@vidya/domain'
import { asId } from '@vidya/domain'

import { type BlockType, BlockTypes } from '../types'

/**
 * Where an identifier comes from.
 *
 * Minted once, at the moment the thing is created, and never derived from a
 * position: submitted homework points at a section id, so an id that changes
 * when the author drags a section is an answer pointing at nothing.
 */
export const newSectionId = (): SectionId => asId<SectionId>(crypto.randomUUID())

export const newBlockId = (): BlockId => asId<BlockId>(crypto.randomUUID())

/** What each kind of block looks like before anyone has typed into it. */
const blanks: Record<BlockType, (id: BlockId) => LessonBlock> = {
  text: (id) => ({ id, type: 'text', content: '' }),
  image: (id) => ({ id, type: 'image', source: 'url', url: '' }),
  video: (id) => ({ id, type: 'video', source: 'url', url: '' }),
  audio: (id) => ({ id, type: 'audio', source: 'url', url: '' }),
  quiz: (id) => ({ id, type: 'quiz', question: '', answers: ['', ''], rightAnswer: 0 }),
}

export const createBlock = (type: BlockType): LessonBlock => blanks[type](newBlockId())

export const isKnownBlockType = (type: string): type is BlockType =>
  (BlockTypes as readonly string[]).includes(type)
