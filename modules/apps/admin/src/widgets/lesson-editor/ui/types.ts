import type {
  AudioBlock,
  LessonBlock,
  LessonContent,
  LessonId,
  LessonSection,
  QuizBlock,
  VideoBlock,
} from '@vidya/domain'

import type { ContentProblem } from '@/features/edit-lesson-content'

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
  frozen?: boolean
  dirty?: boolean
  saving?: boolean
  busy?: boolean
  canPublish?: boolean
  blocked?: boolean
  error?: string
}

export interface EditorToolbarEmits {
  back: []
  save: []
  publish: []
  revision: []
}

export interface LessonContentPanesProps {
  content: LessonContent
  frozen?: boolean
}

export interface LessonContentPanesEmits {
  'update:content': [content: LessonContent]
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

export interface MarkdownTextProps {
  markdown: string
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
