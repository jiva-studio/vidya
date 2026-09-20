import type { EnrollmentId, GroupId } from '@vidya/domain'
import type {
  ArchiveEnrollmentResponse,
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
 * Moderation, archiving and group assignment are `PATCH`, not `POST` —
 * `CrudDecorators` maps all three routes to `UpdateOne`. Archiving carries no
 * body: the tidying holds no data, and who did it is read from the caller.
 */
export const enrollmentApi = (http: HttpClient) => ({
  list: (query: GetEnrollmentsQuery = {}) =>
    http.get<GetEnrollmentsResponse>(Routes().edu.enrollments.find(), query as HttpQuery),

  get: (id: EnrollmentId) => http.get<GetEnrollmentResponse>(Routes().edu.enrollments.get(id)),

  moderate: (id: EnrollmentId, body: ModerateEnrollmentRequest) =>
    http.patch<ModerateEnrollmentResponse>(Routes().edu.enrollments.moderate(id), body),

  archive: (id: EnrollmentId) =>
    http.patch<ArchiveEnrollmentResponse>(Routes().edu.enrollments.archive(id)),

  assignGroup: (id: EnrollmentId, groupId: GroupId | null) =>
    http.patch<AssignEnrollmentGroupResponse>(Routes().edu.enrollments.group(id), {
      groupId,
    } satisfies AssignEnrollmentGroupRequest),
})

export type EnrollmentApi = ReturnType<typeof enrollmentApi>

export const useEnrollmentApi = (): EnrollmentApi => enrollmentApi(useHttp())
