import type { LessonBlock } from '@vidya/domain'

import type {
  LessonPreviewEmits,
  LessonPreviewLabels,
  LessonProgress,
} from '../LessonPreview/types'

export interface BlockPreviewProps {
  block: LessonBlock
  labels: LessonPreviewLabels
  progress?: LessonProgress
}

export type BlockPreviewEmits = LessonPreviewEmits
