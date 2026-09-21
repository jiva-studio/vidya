import type { LessonBlock } from '@vidya/domain'

import type { LessonPreviewLabels } from '../LessonPreview/types'

export interface BlockPreviewProps {
  block: LessonBlock
  labels: LessonPreviewLabels
}
