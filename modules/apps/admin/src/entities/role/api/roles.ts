import type { RoleId, SchoolId } from '@vidya/domain'
import type {
  CreateRoleRequest,
  CreateRoleResponse,
  GetRoleResponse,
  GetRolesResponse,
  UpdateRoleRequest,
  UpdateRoleResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { useCurrentSchool } from '@/shared/access'
import type { HttpClient } from '@/shared/api'
import { useHttp } from '@/shared/api'

/** One page of the roles list, as a screen asks for it. */
export interface RolePageQuery {
  limit?: number
  offset?: number
}

/**
 * Every request the admin makes about a role.
 *
 * A role belongs to one school, so the list is asked for one school and the
 * school travels in the query rather than in a closure — see `useRoleApi`.
 */
export const roleApi = (http: HttpClient) => ({
  list: (schoolId: SchoolId | undefined, page: RolePageQuery = {}) =>
    http.get<GetRolesResponse>(Routes().edu.roles.find(), { schoolId, ...page }),

  get: (id: RoleId) => http.get<GetRoleResponse>(Routes().edu.roles.get(id)),

  create: (body: CreateRoleRequest) =>
    http.post<CreateRoleResponse>(Routes().edu.roles.create(), body),

  update: (id: RoleId, body: UpdateRoleRequest) =>
    http.patch<UpdateRoleResponse>(Routes().edu.roles.update(id), body),

  remove: (id: RoleId) => http.delete(Routes().edu.roles.delete(id)),
})

export type RoleApi = ReturnType<typeof roleApi>

/**
 * The same requests with the current school filled in at the moment of the
 * call. Captured once, it would be the school the screen opened in rather than
 * the one the operator is looking at now.
 */
export const useRoleApi = () => {
  const api = roleApi(useHttp())
  const { schoolId } = useCurrentSchool()

  return { ...api, list: (page?: RolePageQuery) => api.list(schoolId.value, page), schoolId }
}
