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

/**
 * A group as a list names it.
 *
 * `status` lives here and not on {@link GroupDetails} because the CRUD requests
 * are derived from that type: widening it would turn `status` into an ordinary
 * `PATCH` field and let recruitment close around the one action that stamps
 * `startsAt`.
 */
export type GroupSummary = Pick<GroupDetails, 'id' | 'name'> & { status: domain.GroupStatus }

/**
 * A group as it travels to a device.
 *
 * Separate from {@link GroupDetails} because the CRUD requests are derived from
 * that type: `UpdateGroupRequest` is a `Partial` of it, so widening it would
 * turn `status` into an ordinary `PATCH` field and let recruitment close around
 * the one action that stamps `startsAt`.
 */
export type GroupSyncDetails = GroupDetails & {
  schoolId: domain.SchoolId

  /** Stamped when recruitment closes; `null` while the group is still taking students. */
  startsAt: string | null

  status: domain.GroupStatus
}

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
