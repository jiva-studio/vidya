import type { RoleId, SchoolId } from '@vidya/domain'

import type { RoleRow } from '@/entities/role'
import type { SchoolRow } from '@/entities/school'

export interface SchoolsTableRowProps {
  school: SchoolRow
  canUpdate: boolean
}

export interface SchoolsTableRowEmits {
  edit: [id: SchoolId]
  settings: [id: SchoolId]
}

/** Both the create and the edit screen are this component; the id tells them apart. */
export interface SchoolFormPageProps {
  id?: SchoolId
}

export interface SchoolSettingsPageProps {
  id: SchoolId
}

export interface SchoolNameFieldProps {
  modelValue: string
  error?: string
  disabled?: boolean
}

/** The logo travels as a link, so the box holds an address and not a file. */
export interface SchoolLogoFieldProps {
  modelValue: string
  error?: string
  disabled?: boolean
}

export interface SchoolAboutFieldProps {
  modelValue: string
  disabled?: boolean
}

export interface DefaultRoleFieldProps {
  modelValue: string
  options: { value: string; label: string }[]
}

export interface StudentRolesListProps {
  roles: RoleRow[]
  chosen: RoleId[]
  disabled?: boolean
}
