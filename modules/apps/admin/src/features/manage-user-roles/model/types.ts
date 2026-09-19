import type { RoleId, UserId } from '@vidya/domain'

/** The user whose roles are being changed, read at the moment of the request. */
export type UserIdSource = () => UserId

export interface UserRolesState {
  assigned: RoleId[]
}
