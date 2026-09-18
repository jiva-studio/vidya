import * as domain from '@vidya/domain'

export type UserRole = {
  roleId: domain.RoleId
}

export type GetUserRolesListRequest = {
  userId: domain.UserId
}

export type GetUserRolesListResponse = {
  userRoles: UserRole[]
}

export type SetUserRolesQuery = {
  userId: domain.UserId
}

export type SetUserRolesRequest = {
  roleIds: domain.RoleId[]
}

/** Role assignment returns no payload; the meaningful result is the HTTP status. */
export interface SetUserRolesResponse {}
