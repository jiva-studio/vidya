import type { PermissionKey } from '@vidya/domain'

import type { PermissionGroup } from '../model'

export interface PermissionsPickerProps {
  modelValue: PermissionKey[]
  disabled?: boolean
  readonly?: boolean
}

export interface PermissionsPickerEmits {
  'update:modelValue': [value: PermissionKey[]]
}

export interface PermissionGroupFieldsProps {
  group: PermissionGroup
  held: PermissionKey[]
  disabled?: boolean
}

export interface PermissionGroupFieldsEmits {
  toggle: [key: PermissionKey, on: boolean]
  'toggle-group': [group: PermissionGroup, on: boolean]
}
