import type { PermissionKey } from '@vidya/domain'
import type { RoleSummary } from '@vidya/protocol'

/** One line of the roles table. */
export type RoleRow = RoleSummary

/** What the role form edits. The school is added when the form is sent. */
export interface RoleFormValues {
  name: string
  description: string
  permissions: PermissionKey[]
}

/** The permissions of one prefix, in the order the domain lists them. */
export interface PermissionGroup {
  readonly prefix: string
  readonly keys: readonly PermissionKey[]
}

/** How much of one group a role holds. */
export type PermissionGroupState = 'none' | 'some' | 'all'
