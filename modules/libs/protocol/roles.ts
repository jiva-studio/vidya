import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type RoleDetails = {
  id: domain.RoleId
  name: string
  schoolId: domain.SchoolId
  description: string
  permissions: domain.PermissionKey[]
}

export type RoleSummary = Pick<RoleDetails, 'id' | 'name' | 'description'>

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export type CreateRoleRequest = crud.CreateItemRequest<Omit<RoleDetails, 'id'>>
export type CreateRoleResponse = crud.CreateItemResponse<RoleDetails['id']>

/* -------------------------------------------------------------------------- */
/*                                    Read                                    */
/* -------------------------------------------------------------------------- */

export type GetRoleSummariesListQuery = {
  schoolId?: domain.SchoolId
}

export type GetRolesResponse = crud.GetItemsListResponse<RoleSummary>

export type GetRoleResponse = crud.GetItemResponse<RoleDetails>

/* -------------------------------------------------------------------------- */
/*                                   Update                                   */
/* -------------------------------------------------------------------------- */

export type UpdateRoleRequest = crud.UpdateItemRequest<Omit<RoleDetails, 'id'>>

export type UpdateRoleResponse = crud.UpdateItemResponse<RoleDetails>

/* -------------------------------------------------------------------------- */
/*                                   Delete                                   */
/* -------------------------------------------------------------------------- */

export type DeleteRoleResponse = crud.DeleteItemResponse
