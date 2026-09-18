import type { HomeworkId, HomeworkStatus, SectionId } from '@vidya/domain'
import type { LessonBlock } from '@vidya/protocol'

export interface LessonSectionViewModel {
  id: SectionId
  title: string

  /** `unknown` while the section's homework has not been loaded or asked for. */
  state: HomeworkStatus | 'unknown'
  homeworkId?: HomeworkId
  blocks: LessonBlock[]
}
