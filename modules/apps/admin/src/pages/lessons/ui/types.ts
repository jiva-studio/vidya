import type { LessonRow } from '@/entities/lesson'

export interface LessonsTableProps {
  rows: LessonRow[]
  loading?: boolean
  error?: string
  canCreate?: boolean
  canEdit?: boolean
  showCourse?: boolean
}

export interface LessonsTableEmits {
  retry: []
  create: []
  edit: [row: LessonRow]
}

export interface LessonRowProps {
  row: LessonRow
  canEdit?: boolean
  showCourse?: boolean
}

export interface LessonRowEmits {
  edit: [row: LessonRow]
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
  courseId?: string
  courses?: { id: string; name: string }[]
}

export interface AddLessonDialogEmits {
  'update:open': [open: boolean]
  submit: [title: string, courseId?: string]
}
