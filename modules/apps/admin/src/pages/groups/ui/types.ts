import type { GroupSummary } from '@vidya/protocol'

import type { GroupFormValues, GroupMember } from '@/entities/group'

export interface GroupsTableProps {
  rows: GroupSummary[]
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
  row: GroupSummary
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
}

export interface GroupMembersEmits {
  retry: []
}

export interface GroupMemberRowProps {
  row: GroupMember
}
