import type { RoleId } from '@vidya/domain'

import type { RoleRow } from '@/entities/role'

export interface UserRolesSelectorProps {
  available: RoleRow[]
  selected: RoleId[]
  loading?: boolean
  error?: string
}

export interface UserRolesSelectorEmits {
  toggle: [roleId: RoleId, wanted: boolean]
  retry: []
}
