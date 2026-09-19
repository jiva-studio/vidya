import type { AudioBlock, LessonBlock, QuizBlock, TextBlock, VideoBlock } from '@vidya/domain'
import type { Ref } from 'vue'

import type { BlockType, MoveDirection } from '../types'

/** A published version is frozen: every control below reads it and none writes. */
interface Frozen {
  frozen?: boolean
}

export interface SectionBlocksProps extends Frozen {
  blocks: readonly LessonBlock[]
}

export interface LessonBlockEditorProps extends Frozen {
  block: LessonBlock
}

export interface LessonBlockEditorEmits {
  update: [block: LessonBlock]
  slash: []
  escape: []
}

/** The gutter's two controls, and where each block sits among its neighbours. */
interface Placed {
  first?: boolean
  last?: boolean
}

export interface LessonBlockFrameProps extends Frozen, Placed {
  block: LessonBlock
  autofocus?: boolean
}

export interface LessonBlockFrameEmits {
  update: [block: LessonBlock]
  insert: [type: BlockType]
  move: [delta: MoveDirection]
  duplicate: []
  remove: []
}

export interface BlockHandleProps extends Placed {
  label: string
  open?: boolean
}

export interface BlockHandleEmits {
  'update:open': [open: boolean]
  move: [delta: MoveDirection]
  duplicate: []
  remove: []
}

export interface BlockInserterProps {
  label: string
  open?: boolean
}

export interface BlockInserterEmits {
  'update:open': [open: boolean]
  pick: [type: BlockType]
}

export type BlockMenuProps = Placed

export interface BlockMenuEmits {
  move: [delta: MoveDirection]
  duplicate: []
  remove: []
}

export interface BlockInsertMenuEmits {
  pick: [type: BlockType]
  close: []
}

export interface MarkdownEditorOptions {
  host: Ref<HTMLElement | null>
  doc: Ref<string>
  onChange: (text: string) => void
  onSlash: () => void
  onEscape: () => void
}

export interface MarkdownEditor {
  focused: Ref<boolean>
  focus: () => void
}

export interface BlockShellProps extends Frozen {
  label: string
  index: number
  count: number
}

export interface MarkdownTextProps {
  markdown: string

  /** Renders one line: a heading marker stays the characters the author typed. */
  inline?: boolean
}

export interface UnknownBlockNoticeProps {
  type: string
}

export interface TextBlockEditorProps extends Frozen {
  block: TextBlock
}

export interface TextBlockEditorEmits {
  update: [block: TextBlock]
  slash: []
  escape: []
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

/** Where the caret goes when the list hands focus to a row it did not have. */
export type AnswerCaret = 'start' | 'end'

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
  split: [index: number]
  collapse: [index: number]
  move: [index: number, delta: MoveDirection]
}
