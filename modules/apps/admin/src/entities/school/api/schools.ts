import type { SchoolId } from '@vidya/domain'
import type {
  CreateSchoolRequest,
  CreateSchoolResponse,
  GetSchoolResponse,
  GetSchoolsResponse,
  UpdateSchoolRequest,
  UpdateSchoolResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/shared/api'
import { useHttp } from '@/shared/api'

import type {
  SchoolConfigs,
  UpdateSchoolConfigsRequest,
  UpdateSchoolConfigsResponse,
} from './types'

/**
 * Every request the admin makes about a school.
 *
 * The transport is an argument rather than something reached for, so the same
 * builders are exercised by a unit test over the fake client and by the screen
 * over the real one. `GET /edu/schools` is scoped by the server to what the
 * token grants, which is why it takes no school of its own.
 */
export const schoolApi = (http: HttpClient) => ({
  list: () => http.get<GetSchoolsResponse>(Routes().edu.schools.find()),

  get: (id: SchoolId) => http.get<GetSchoolResponse>(Routes().edu.schools.get(id)),

  create: (body: CreateSchoolRequest) =>
    http.post<CreateSchoolResponse>(Routes().edu.schools.create(), body),

  update: (id: SchoolId, body: UpdateSchoolRequest) =>
    http.patch<UpdateSchoolResponse>(Routes().edu.schools.update(id), body),

  configs: (id: SchoolId) => http.get<SchoolConfigs>(Routes().edu.schools.configs.getAll(id)),

  saveConfigs: (id: SchoolId, body: UpdateSchoolConfigsRequest) =>
    http.patch<UpdateSchoolConfigsResponse>(Routes().edu.schools.configs.update(id), body),
})

export type SchoolApi = ReturnType<typeof schoolApi>

/** How a screen gets the school requests: one seam, swapped in tests. */
export const useSchoolApi = (): SchoolApi => schoolApi(useHttp())
