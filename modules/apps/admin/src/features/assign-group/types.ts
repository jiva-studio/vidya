import type { CourseId, GroupId } from '@vidya/domain'

export interface GroupAssignDialogProps {
  open?: boolean

  /** The groups offered are this course's; a group from another is refused. */
  courseId?: CourseId

  groupId?: GroupId
  busy?: boolean
  error?: string
}

export interface GroupAssignDialogEmits {
  'update:open': [open: boolean]
  submit: [groupId: GroupId | null]
}
