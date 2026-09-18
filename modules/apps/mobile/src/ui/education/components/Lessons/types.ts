import type { BlockId, HomeworkId, HomeworkStatus, SectionId } from '@vidya/domain'
import type { LessonBlock, LessonBlockState, LessonSummary } from '@vidya/protocol'

export interface LessonSectionViewModel {
  id: SectionId
  title: string

  /** `unknown` while the section's homework has not been loaded or asked for. */
  state: HomeworkStatus | 'unknown'
  homeworkId?: HomeworkId
  blocks: LessonBlock[]
}

export interface LessonsListProps {
  items: readonly LessonSummary[]
}

export interface LessonsListEmits {
  click: [lessonId: LessonSummary['id']]
}

export interface LessonsListItemProps {
  item: LessonSummary
}

export interface LessonsListItemEmits {
  click: []
}

export interface LessonSectionsListProps {
  items: readonly LessonSectionViewModel[]
}

export interface LessonSectionViewProps {
  blocks: LessonBlock[]

  /** What this student has already done, keyed by block. */
  states: Readonly<Record<BlockId, LessonBlockState>>
}

export interface LessonSectionViewEmits {
  change: [blockId: BlockId, state: LessonBlockState]
}
