import type { LessonSection } from '@vidya/domain'

import type {
  LessonPreviewEmits,
  LessonPreviewLabels,
  LessonProgress,
} from '../LessonPreview/types'

export interface SectionPreviewProps {
  section: LessonSection
  labels: LessonPreviewLabels
  progress?: LessonProgress
}

export type SectionPreviewEmits = LessonPreviewEmits
