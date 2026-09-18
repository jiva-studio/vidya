import * as domain from '@vidya/domain'

import * as crud from './crud'

/* -------------------------------------------------------------------------- */
/*                                   Models                                   */
/* -------------------------------------------------------------------------- */

export type GroupDetails = {
  id: domain.GroupId
  courseId: domain.CourseId
  name: string
  description?: string
}

export type GroupSummary = Pick<GroupDetails, 'id' | 'name'>

/* -------------------------------------------------------------------------- */
/*                                    CRUD                                    */
/* -------------------------------------------------------------------------- */

export type CreateGroupRequest = crud.CreateItemRequest<Omit<GroupDetails, 'id'>>
export type CreateGroupResponse = crud.CreateItemResponse<GroupDetails['id']>

export type GetGroupsQuery = { courseId?: string }
export type GetGroupsResponse = crud.GetItemsListResponse<GroupSummary>
export type GetGroupResponse = crud.GetItemResponse<GroupDetails>

export type UpdateGroupRequest = crud.UpdateItemRequest<Omit<GroupDetails, 'id' | 'courseId'>>
export type UpdateGroupResponse = crud.UpdateItemResponse<GroupDetails>

export type DeleteGroupResponse = crud.DeleteItemResponse
