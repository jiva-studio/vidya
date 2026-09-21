import type { LessonSection } from '@vidya/domain'

import type { LessonPreviewLabels } from '../LessonPreview/types'

export interface SectionPreviewProps {
  section: LessonSection
  labels: LessonPreviewLabels
}
