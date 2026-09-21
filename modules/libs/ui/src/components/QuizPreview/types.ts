import type { QuizBlock, QuizBlockState } from '@vidya/domain'

import type { LessonPreviewLabels, LessonProgress } from '../LessonPreview/types'

export interface QuizPreviewProps {
  block: QuizBlock
  labels: LessonPreviewLabels
  progress?: LessonProgress
}

export interface QuizPreviewEmits {
  change: [state: QuizBlockState]
}
