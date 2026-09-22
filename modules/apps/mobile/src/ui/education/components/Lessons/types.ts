import type { LocalLesson } from '@vidya/client'
import type { BlockId, LessonId, SectionId } from '@vidya/domain'
import type { LessonBlock, LessonBlockState } from '@vidya/protocol'

import type { MediaAddresses, MediaUnavailableReason } from '../../model/sectionMedia'

/** What the section strip shows: a label to press, and which one is pressed. */
export interface LessonSectionViewModel {
  id: SectionId
  title: string
}

export interface LessonsListProps {
  items: readonly LocalLesson[]
}

export interface LessonsListEmits {
  click: [lessonId: LessonId]
}

export interface LessonsListItemProps {
  item: LocalLesson
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

  /** Where each source of the section plays, keyed by what the block stores. */
  addresses: MediaAddresses

  /** What a block with no address says, which is why it has none. */
  unavailableReason: MediaUnavailableReason
}

export interface LessonSectionViewEmits {
  change: [blockId: BlockId, state: LessonBlockState]
}
