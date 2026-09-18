import type { EnrollmentId } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'

import type { EnrollmentFilters, EnrollmentRow } from '@/entities/enrollment'

export interface EnrollmentsFiltersProps {
  filters: EnrollmentFilters
  courseOptions: SelectOption[]
  groupOptions: SelectOption[]
}

export interface EnrollmentsFiltersEmits {
  'update:filters': [filters: EnrollmentFilters]
}

export interface EnrollmentsTableRowProps {
  enrollment: EnrollmentRow
  canModerate?: boolean
  busy?: boolean
}

export interface EnrollmentsTableRowEmits {
  accept: [id: EnrollmentId]
  decline: [id: EnrollmentId]
  'assign-group': [id: EnrollmentId]
}
