import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type UserSummary = {
  id: domain.UserId
  name: string

  /** The roles this person holds in the school being listed. */
  roles: UserRoleSummary[]
}

/** A role as a row of the people list names it. */
export type UserRoleSummary = {
  id: domain.RoleId
  name: string
}

export type UserDetailsRole = {
  id: domain.RoleId
  name?: string
}

export type UserDetails = Omit<UserSummary, 'roles'> & {
  email: string
  phone?: string
  roles: UserDetailsRole[]
}

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetUsersQuery = crud.PageQuery & {
  schoolId?: domain.SchoolId
  query?: string
}

export type GetUserResponse = crud.GetItemResponse<UserDetails>

export type GetUsersResponse = crud.GetPagedItemsListResponse<UserSummary>

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export type UpdateUserRequest = crud.UpdateItemRequest<Omit<UserDetails, 'id'>>

export type UpdateUserResponse = crud.UpdateItemResponse<UserDetails>
