import type { BlockId, SectionId } from '@vidya/domain'
import type { LessonBlock, LessonBlockState, LessonSummary } from '@vidya/protocol'

/** What the section strip shows: a label to press, and which one is pressed. */
export interface LessonSectionViewModel {
  id: SectionId
  title: string
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
