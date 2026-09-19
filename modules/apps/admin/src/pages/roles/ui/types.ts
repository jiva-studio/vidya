import type { PermissionKey, RoleId } from '@vidya/domain'

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

export interface RoleFormFieldsProps {
  name: string
  description: string
  permissions: PermissionKey[]
  nameError?: string
  busy?: boolean
  readonly?: boolean
}

export interface RoleFormFieldsEmits {
  'update:name': [value: string]
  'update:description': [value: string]
  'update:permissions': [value: PermissionKey[]]
}
