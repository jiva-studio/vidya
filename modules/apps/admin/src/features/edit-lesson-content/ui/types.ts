import type {
  AudioBlock,
  BlockId,
  LessonBlock,
  LessonSection,
  QuizBlock,
  SectionId,
  TextBlock,
  VideoBlock,
} from '@vidya/domain'

import type { BlockType, MoveDirection } from '../types'

/** A published version is frozen: every control below reads it and none writes. */
interface Frozen {
  frozen?: boolean
}

export interface SectionListProps extends Frozen {
  sections: readonly LessonSection[]
  selectedId?: SectionId
}

export interface SectionListEmits {
  select: [id: SectionId]
  add: []
  move: [id: SectionId, delta: MoveDirection]
  remove: [id: SectionId]
}

export interface SectionListRowProps extends Frozen {
  section: LessonSection
  index: number
  count: number
  selected?: boolean
}

export interface SectionListRowEmits {
  select: [id: SectionId]
  move: [id: SectionId, delta: MoveDirection]
  remove: [id: SectionId]
}

export interface SectionFormProps extends Frozen {
  section: LessonSection
}

export interface SectionFormEmits {
  rename: [id: SectionId, title: string]
  assessment: [id: SectionId, assessment: LessonSection['assessment']]
}

export interface BlockListProps extends Frozen {
  blocks: readonly LessonBlock[]
}

export interface BlockListEmits {
  add: [type: BlockType]
  update: [block: LessonBlock]
  move: [id: BlockId, delta: MoveDirection]
  remove: [id: BlockId]
}

export interface BlockListItemProps extends Frozen {
  block: LessonBlock
  index: number
  count: number
}

export interface BlockListItemEmits {
  update: [block: LessonBlock]
  move: [id: BlockId, delta: MoveDirection]
  remove: [id: BlockId]
}

export interface TextBlockEditorProps extends Frozen {
  block: TextBlock
}

export interface TextBlockEditorEmits {
  update: [block: TextBlock]
}

export interface VideoBlockEditorProps extends Frozen {
  block: VideoBlock
}

export interface VideoBlockEditorEmits {
  update: [block: VideoBlock]
}

export interface AudioBlockEditorProps extends Frozen {
  block: AudioBlock
}

export interface AudioBlockEditorEmits {
  update: [block: AudioBlock]
}

export interface QuizBlockEditorProps extends Frozen {
  block: QuizBlock
}

export interface QuizBlockEditorEmits {
  update: [block: QuizBlock]
}

export interface QuizAnswerRowProps extends Frozen {
  name: string
  index: number
  text: string
  right?: boolean
}

export interface QuizAnswerRowEmits {
  text: [index: number, text: string]
  right: [index: number]
  remove: [index: number]
}

export interface MoveButtonsProps {
  index: number
  count: number
  upLabel: string
  downLabel: string
}

export interface MoveButtonsEmits {
  move: [delta: MoveDirection]
}
