export type UserRole = {
  roleId: string
}

export type GetUserRolesListRequest = {
  userId: string
}

export type GetUserRolesListResponse = {
  userRoles: UserRole[]
}

export type SetUserRolesQuery = {
  userId: string
}

export type SetUserRolesRequest = {
  roleIds: string[]
}

/** Role assignment returns no payload; the meaningful result is the HTTP status. */
export interface SetUserRolesResponse {}
