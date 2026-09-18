import type { RoleId } from '@vidya/domain'

import type { RoleRow } from '@/entities/role'

export interface RolesTableRowProps {
  role: RoleRow
  canUpdate: boolean
}

export interface RolesTableRowEmits {
  edit: [id: RoleId]
}

/** Both the create and the edit screen are this component; the id tells them apart. */
export interface RoleFormPageProps {
  id?: RoleId
}
