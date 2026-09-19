import type { HomeworkId } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'

import type { HomeworkFilters, HomeworkRow } from '@/entities/homework'

export interface HomeworkQueueFiltersProps {
  filters: HomeworkFilters
  courseOptions: SelectOption[]
  groupOptions: SelectOption[]
}

export interface HomeworkQueueFiltersEmits {
  'update:filters': [filters: HomeworkFilters]
}

export interface HomeworkQueueRowProps {
  row: HomeworkRow
}

export interface HomeworkQueueRowEmits {
  open: [id: HomeworkId]
}
