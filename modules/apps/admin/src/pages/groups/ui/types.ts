import type { GroupSummary } from '@vidya/protocol'

import type { GroupFormValues, GroupMember } from '@/entities/group'

/** A group as the list shows it: the summary, with its course named. */
export type GroupListRow = GroupSummary & { courseName?: string }

export interface GroupsTableProps {
  rows: GroupListRow[]
  emptyTitle?: string
  emptyDescription?: string
  loading?: boolean
  error?: string
  canCreate?: boolean
  canEdit?: boolean
}

export interface GroupsTableEmits {
  retry: []
  create: []
  edit: [id: string]
  members: [id: string]
}

export interface GroupRowProps {
  row: GroupListRow
  canEdit?: boolean
}

export interface GroupRowEmits {
  edit: [id: string]
  members: [id: string]
}

export interface GroupFormProps {
  modelValue: GroupFormValues
  courses: { value: string; label: string }[]
  courseLocked?: boolean
  busy?: boolean
  error?: string
}

export interface GroupFormEmits {
  'update:modelValue': [values: GroupFormValues]
  submit: []
  cancel: []
}

export interface GroupMembersProps {
  rows: GroupMember[]
  loading?: boolean
  error?: string

  /** Without `enrollments:moderate` the roster is a list, not a set of levers. */
  canModerate?: boolean

  busy?: string
}

export interface GroupMembersEmits {
  retry: []
  revoke: [enrollmentId: string]
  move: [enrollmentId: string]
}

export interface GroupMemberRowProps {
  row: GroupMember
  canModerate?: boolean
  busy?: boolean
}

export interface GroupMemberRowEmits {
  revoke: [enrollmentId: string]
  move: [enrollmentId: string]
}
