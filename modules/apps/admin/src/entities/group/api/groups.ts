import type { CourseId, GroupId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import type {
  CreateGroupRequest,
  CreateGroupResponse,
  GetGroupResponse,
  GetGroupsQuery,
  GetGroupsResponse,
  UpdateGroupRequest,
  UpdateGroupResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/shared/api'

import type { GroupFormValues } from '../types'

/**
 * The group endpoints.
 *
 * A group belongs to a course and takes its school from it, so `GetGroupsQuery`
 * offers a course and no school; the server scopes the answer by the caller's
 * grants either way.
 */
export const getGroups = (http: HttpClient, query: GetGroupsQuery): Promise<GetGroupsResponse> =>
  http.get<GetGroupsResponse>(Routes().edu.groups.find(), {
    courseId: query.courseId,
    limit: query.limit,
    offset: query.offset,
  })

export const getGroup = (http: HttpClient, id: GroupId): Promise<GetGroupResponse> =>
  http.get<GetGroupResponse>(Routes().edu.groups.get(id))

export const createGroup = (
  http: HttpClient,
  values: GroupFormValues,
): Promise<CreateGroupResponse> =>
  http.post<CreateGroupResponse>(Routes().edu.groups.create(), {
    courseId: asId<CourseId>(values.courseId),
    name: values.name,
    description: values.description,
  } satisfies CreateGroupRequest)

/** The course is fixed once the group exists: moving a group between courses
 * would orphan every enrolment pointing at it, and the request has no field
 * for it. */
export const updateGroup = (
  http: HttpClient,
  id: GroupId,
  values: GroupFormValues,
): Promise<UpdateGroupResponse> =>
  http.patch<UpdateGroupResponse>(Routes().edu.groups.update(id), {
    name: values.name,
    description: values.description,
  } satisfies UpdateGroupRequest)
