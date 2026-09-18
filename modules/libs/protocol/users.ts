import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type UserSummary = {
  id: domain.UserId
  name: string
}

export type UserDetailsRole = {
  id: domain.RoleId
  name?: string
}

export type UserDetails = UserSummary & {
  email: string
  phone?: string
  roles: UserDetailsRole[]
}

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetUsersQuery = {
  schoolId?: domain.SchoolId
}

export type GetUserResponse = crud.GetItemResponse<UserDetails>

export type GetUsersResponse = crud.GetItemsListResponse<UserSummary>

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export type UpdateUserRequest = crud.UpdateItemRequest<Omit<UserDetails, 'id'>>

export type UpdateUserResponse = crud.UpdateItemResponse<UserDetails>
