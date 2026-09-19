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

export interface ItemActionsProps {
  index: number
  count: number
  upLabel: string
  downLabel: string
  removeLabel: string
}

export interface ItemActionsEmits {
  move: [delta: MoveDirection]
  remove: []
}

export interface AddBlockMenuProps {
  label?: string
}

export interface AddBlockMenuEmits {
  add: [type: BlockType]
}

export interface SectionFormProps extends Frozen {
  section: LessonSection
  autofocus?: boolean
}

export interface SectionFormEmits {
  rename: [id: SectionId, title: string]
  assessment: [id: SectionId, assessment: LessonSection['assessment']]
}

export interface SectionBlocksProps extends Frozen {
  blocks: readonly LessonBlock[]
}

export interface SectionBlocksEmits {
  add: [type: BlockType]
  update: [block: LessonBlock]
  move: [id: BlockId, delta: MoveDirection]
  remove: [id: BlockId]
}

export interface LessonBlockEditorProps extends Frozen {
  block: LessonBlock
  index: number
  count: number
}

export interface LessonBlockEditorEmits {
  update: [block: LessonBlock]
  move: [id: BlockId, delta: MoveDirection]
  remove: [id: BlockId]
}

export interface BlockShellProps extends Frozen {
  label: string
  index: number
  count: number
}

export interface BlockShellEmits {
  move: [delta: MoveDirection]
  remove: []
}

export interface MarkdownTextProps {
  markdown: string
}

export interface UnknownBlockNoticeProps {
  type: string
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
  autofocus?: boolean
}

export interface QuizAnswerRowEmits {
  text: [index: number, text: string]
  right: [index: number]
  remove: [index: number]
}
