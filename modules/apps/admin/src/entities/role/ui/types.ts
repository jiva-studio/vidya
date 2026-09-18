import type { PermissionKey } from '@vidya/domain'

export interface PermissionsPickerProps {
  modelValue: PermissionKey[]
  disabled?: boolean
}

export interface PermissionsPickerEmits {
  'update:modelValue': [value: PermissionKey[]]
}
