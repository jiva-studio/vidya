import type {
  AudioBlock,
  BlockId,
  LessonBlock,
  LessonContent,
  LessonId,
  LessonSection,
  QuizBlock,
  SectionId,
  VideoBlock,
} from '@vidya/domain'

import type {
  BlockFault,
  BlockType,
  ContentProblem,
  MoveDirection,
} from '@/features/edit-lesson-content'

import type { AutosaveStatus } from '../model'

/** Writing the lesson, or reading it the way a student will. */
export type EditorMode = 'write' | 'read'

export interface LessonEditorViewProps {
  lessonId: LessonId
  /** Shown in the toolbar so the operator knows which lesson is open. */
  title?: string
}

export interface LessonEditorViewEmits {
  back: []
}

export interface EditorToolbarProps {
  title?: string
  version?: number
  mode?: EditorMode
  frozen?: boolean
  dirty?: boolean
  status?: AutosaveStatus
  busy?: boolean
  publishable?: boolean
  blocked?: boolean
  error?: string
}

export interface EditorToolbarEmits {
  back: []
  save: []
  retry: []
  publish: []
  revision: []
  'update:mode': [mode: EditorMode]
}

export interface LessonOutlineProps {
  sections: readonly LessonSection[]
}

export interface LessonDocumentProps {
  content: LessonContent
  frozen?: boolean
}

export interface LessonDocumentEmits {
  'update:content': [content: LessonContent]
}

/** Where a section sits among its neighbours, so its menu can stop at the ends. */
interface Placed {
  first?: boolean
  last?: boolean
}

export interface SectionEditorProps extends Placed {
  section: LessonSection
  frozen?: boolean
  autofocus?: boolean

  /** The block the caret belongs in, when it is one of this section's. */
  caret?: BlockId
}

export interface SectionEditorEmits {
  rename: [id: SectionId, title: string]
  assessment: [id: SectionId, assessment: LessonSection['assessment']]
  move: [id: SectionId, delta: MoveDirection]
  reorder: [id: SectionId, from: number, to: number]
  remove: [id: SectionId]
  'block-update': [id: SectionId, block: LessonBlock]
  'block-insert': [id: SectionId, afterId: BlockId | undefined, type: BlockType]
  'block-move': [id: SectionId, blockId: BlockId, delta: MoveDirection]
  'block-duplicate': [id: SectionId, blockId: BlockId]
  'block-remove': [id: SectionId, blockId: BlockId]
}

export interface SectionHeaderProps extends Placed {
  section: LessonSection
  frozen?: boolean
  autofocus?: boolean
}

export interface SectionHeaderEmits {
  rename: [title: string]
  assessment: [assessment: LessonSection['assessment']]
  move: [delta: MoveDirection]
  remove: []
}

export interface SectionMenuProps extends Placed {
  label: string
}

export interface SectionMenuEmits {
  move: [delta: MoveDirection]
  assessment: [assessment: LessonSection['assessment']]
  remove: []
}

export interface SectionInsertBarEmits {
  pick: [type: BlockType]
}

export interface ContentProblemsNoticeProps {
  problems?: readonly ContentProblem[]
  faults?: readonly BlockFault[]
}

export interface LessonPreviewProps {
  content: LessonContent
}

export interface SectionPreviewProps {
  section: LessonSection
}

export interface BlockPreviewProps {
  block: LessonBlock
}

export interface MediaPreviewProps {
  block: VideoBlock | AudioBlock
}

export interface QuizPreviewProps {
  block: QuizBlock
}

export interface UnsavedChangesGuardProps {
  dirty?: boolean
}
