import type { HomeworkId, LessonId, LessonVersionId } from '@vidya/domain'
import type { HomeworkDetails } from '@vidya/protocol'
import type { SelectOption } from '@vidya/ui'

import type { HomeworkFilters, HomeworkRow } from '@/entities/homework'

export interface HomeworkReviewPaneProps {
  /** Opens with this work already selected, for a link straight to one. */
  initialId?: HomeworkId
}

export interface QueueFiltersProps {
  filters: HomeworkFilters
  courseOptions: SelectOption[]
  groupOptions: SelectOption[]
}

export interface QueueFiltersEmits {
  'update:filters': [filters: HomeworkFilters]
}

export interface HomeworkQueueTableProps {
  rows: HomeworkRow[]
  selectedId?: HomeworkId
  loading?: boolean
  error?: string
}

export interface HomeworkQueueTableEmits {
  select: [id: HomeworkId]
  retry: []
}

export interface HomeworkQueueRowProps {
  row: HomeworkRow
  selected?: boolean
}

export interface HomeworkQueueRowEmits {
  select: [id: HomeworkId]
}

export interface HomeworkAnswerProps {
  work: HomeworkDetails
  row?: HomeworkRow

  /** The lesson holding the answered version, when it was found. */
  answeredLessonId?: LessonId

  /** Who decided, once the name has been resolved. */
  reviewerName?: string
}

export interface SupersededVersionNoticeProps {
  /** The version the student answered, which is no longer the published one. */
  lessonVersionId: LessonVersionId

  /** The lesson that version belongs to, once it has been resolved. */
  lessonId?: LessonId
}
