import type { GroupId } from '@vidya/domain'

import type { GroupSummary } from '../components/Groups'

export interface GroupSelectorProps {
  groups: readonly GroupSummary[]
  modelValue: GroupId | null
}

export interface GroupSelectorEmits {
  'update:modelValue': [groupId: GroupId | null]
}
