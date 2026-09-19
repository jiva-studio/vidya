import type { LessonRow } from '@/entities/lesson'

export interface LessonsTableProps {
  rows: LessonRow[]
  loading?: boolean
  error?: string
  canCreate?: boolean
  canEdit?: boolean
}

export interface LessonsTableEmits {
  retry: []
  create: []
  edit: [id: string]
}

export interface LessonRowProps {
  row: LessonRow
  canEdit?: boolean
}

export interface LessonRowEmits {
  edit: [id: string]
}

export interface LessonVersionBadgeProps {
  state?: LessonRow['state']
  publishedVersion?: number
  draftVersion?: number
}

export interface AddLessonDialogProps {
  open?: boolean
  busy?: boolean
  error?: string
}

export interface AddLessonDialogEmits {
  'update:open': [open: boolean]
  submit: [title: string]
}
