// Public API of the role entity. Owned by T2.
export type { RoleApi } from './api'
export { roleApi, useRoleApi } from './api'
export type { PermissionGroup, PermissionGroupState, RoleFormValues, RoleRow } from './model'
export {
  actionOf,
  groupPermissions,
  groupState,
  prefixOf,
  toggleGroup,
  togglePermission,
  useRoles,
  WILDCARD_GROUP,
} from './model'
export type { PermissionsPickerProps } from './ui'
export { PermissionsPicker } from './ui'
