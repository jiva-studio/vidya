import type { AudioBlock, VideoBlock } from '@vidya/domain'

import type { LessonPreviewLabels } from '../LessonPreview/types'

export interface MediaPreviewProps {
  block: VideoBlock | AudioBlock
  labels: LessonPreviewLabels
}
