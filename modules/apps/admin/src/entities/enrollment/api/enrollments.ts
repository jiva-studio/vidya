import type { EnrollmentId, GroupId } from '@vidya/domain'
import type {
  AssignEnrollmentGroupRequest,
  AssignEnrollmentGroupResponse,
  GetEnrollmentResponse,
  GetEnrollmentsQuery,
  GetEnrollmentsResponse,
  ModerateEnrollmentRequest,
  ModerateEnrollmentResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient, HttpQuery } from '@/shared/api'
import { useHttp } from '@/shared/api'

/**
 * Every request the admin makes about an enrolment.
 *
 * `GetEnrollmentsQuery` takes no school: the server narrows the list by the
 * permissions in the token instead, so nothing here passes `schoolId`. The
 * screen filters what comes back by the courses of the current school.
 *
 * Moderation and group assignment are `PATCH`, not `POST` — `CrudDecorators`
 * maps both routes to `UpdateOne`.
 */
export const enrollmentApi = (http: HttpClient) => ({
  list: (query: GetEnrollmentsQuery = {}) =>
    http.get<GetEnrollmentsResponse>(Routes().edu.enrollments.find(), query as HttpQuery),

  get: (id: EnrollmentId) => http.get<GetEnrollmentResponse>(Routes().edu.enrollments.get(id)),

  moderate: (id: EnrollmentId, body: ModerateEnrollmentRequest) =>
    http.patch<ModerateEnrollmentResponse>(Routes().edu.enrollments.moderate(id), body),

  assignGroup: (id: EnrollmentId, groupId: GroupId | null) =>
    http.patch<AssignEnrollmentGroupResponse>(Routes().edu.enrollments.group(id), {
      groupId,
    } satisfies AssignEnrollmentGroupRequest),
})

export type EnrollmentApi = ReturnType<typeof enrollmentApi>

export const useEnrollmentApi = (): EnrollmentApi => enrollmentApi(useHttp())
