import type { AudioBlock, AudioBlockState, VideoBlock, VideoBlockState } from '@vidya/domain'

import type { LessonPreviewLabels, LessonProgress } from '../LessonPreview/types'

export interface MediaPreviewProps {
  block: VideoBlock | AudioBlock
  labels: LessonPreviewLabels
  progress?: LessonProgress
}

export interface MediaPreviewEmits {
  change: [state: VideoBlockState | AudioBlockState]
}
