import type { CourseSummary } from '@vidya/protocol'

import type { CourseFormValues } from '@/entities/course'

export interface CoursesTableProps {
  rows: CourseSummary[]
  loading?: boolean
  error?: string
  canCreate?: boolean
  canEdit?: boolean
}

export interface CoursesTableEmits {
  retry: []
  create: []
  edit: [id: string]
  lessons: [id: string]
}

export interface CourseRowProps {
  row: CourseSummary
  canEdit?: boolean
}

export interface CourseRowEmits {
  edit: [id: string]
  lessons: [id: string]
}

/** `publishable` is off while creating: a course that does not exist yet cannot be published. */
export interface CourseFormProps {
  modelValue: CourseFormValues
  busy?: boolean
  error?: string
  submitLabel?: string
  publishable?: boolean
}

export interface CourseFormEmits {
  'update:modelValue': [values: CourseFormValues]
  submit: []
  cancel: []
}

export interface CourseCoverFieldProps {
  modelValue?: string | null
  error?: string
  disabled?: boolean
}

export interface CourseCoverFieldEmits {
  'update:modelValue': [value: string | null]
}
