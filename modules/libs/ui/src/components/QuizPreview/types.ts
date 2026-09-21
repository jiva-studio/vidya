import type { QuizBlock } from '@vidya/domain'

import type { LessonPreviewLabels } from '../LessonPreview/types'

export interface QuizPreviewProps {
  block: QuizBlock
  labels: LessonPreviewLabels
}
