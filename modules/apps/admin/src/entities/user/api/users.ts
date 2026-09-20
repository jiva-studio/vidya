import type { RoleId, SchoolId, UserId } from '@vidya/domain'
import type {
  GetUserResponse,
  GetUserRolesListResponse,
  GetUsersResponse,
  SetUserRolesRequest,
  SetUserRolesResponse,
  UpdateUserRequest,
  UpdateUserResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { useCurrentSchool } from '@/shared/access'
import type { HttpClient } from '@/shared/api'
import { useHttp } from '@/shared/api'

import type { GetUserSchoolsResponse } from './types'

/**
 * Every request the admin makes about a user.
 *
 * Roles are set, not added one at a time: the API takes the whole set and the
 * server keeps what it is given, so removing a role is sending the set without
 * it. The routes for deleting a single assignment exist in `Routes()` but no
 * controller answers them.
 */
export const userApi = (http: HttpClient) => ({
  list: (schoolId: SchoolId | undefined) =>
    http.get<GetUsersResponse>(Routes().edu.user().find(), { schoolId }),

  get: (id: UserId) => http.get<GetUserResponse>(Routes().edu.user(id).get()),

  /**
   * The same read, for a screen that only wants the name if it may have it.
   *
   * `users:read` is a right of its own: a reviewer without it still has work to
   * do, and the rows show identifiers instead of complaining once per row.
   */
  nameOf: (id: UserId) =>
    http.get<GetUserResponse>(Routes().edu.user(id).get(), undefined, { quiet: true }),

  update: (id: UserId, body: UpdateUserRequest) =>
    http.patch<UpdateUserResponse>(Routes().edu.user(id).update(), body),

  roles: (id: UserId) => http.get<GetUserRolesListResponse>(Routes().edu.user(id).roles.all()),

  setRoles: (id: UserId, roleIds: RoleId[]) =>
    http.post<SetUserRolesResponse>(Routes().edu.user(id).roles.create(), {
      roleIds,
    } satisfies SetUserRolesRequest),

  schools: (id: UserId) => http.get<GetUserSchoolsResponse>(Routes().edu.user(id).schools.all()),
})

export type UserApi = ReturnType<typeof userApi>

/**
 * The same requests with the current school filled in at the moment of the
 * call, which is the only moment at which it is known to be current.
 */
export const useUserApi = () => {
  const api = userApi(useHttp())
  const { schoolId } = useCurrentSchool()

  return { ...api, list: () => api.list(schoolId.value), schoolId }
}
