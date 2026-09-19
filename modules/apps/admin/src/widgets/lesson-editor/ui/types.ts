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

import type { BlockType, ContentProblem, MoveDirection } from '@/features/edit-lesson-content'

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
  saving?: boolean
  busy?: boolean
  publishable?: boolean
  blocked?: boolean
  error?: string
}

export interface EditorToolbarEmits {
  back: []
  save: []
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

export interface SectionEditorProps {
  section: LessonSection
  index: number
  count: number
  frozen?: boolean
  autofocus?: boolean
}

export interface SectionEditorEmits {
  rename: [id: SectionId, title: string]
  assessment: [id: SectionId, assessment: LessonSection['assessment']]
  move: [id: SectionId, delta: MoveDirection]
  remove: [id: SectionId]
  'block-add': [id: SectionId, type: BlockType]
  'block-update': [id: SectionId, block: LessonBlock]
  'block-move': [id: SectionId, blockId: BlockId, delta: MoveDirection]
  'block-remove': [id: SectionId, blockId: BlockId]
}

export interface ContentProblemsNoticeProps {
  problems: readonly ContentProblem[]
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
