import type { EnrollmentId, GroupId, SchoolId, UserId } from '@vidya/domain'
import type {
  GetEnrollmentResponse,
  GetEnrollmentsResponse,
  GetUserResponse,
  GetUsersResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import type { HttpClient } from '@/shared/api'

/**
 * The enrolments that make up a group's roster.
 *
 * The group holds no list of students: membership is an enrolment pointing at
 * the group, which is also how a student is moved between groups.
 */
export const getGroupEnrollments = (
  http: HttpClient,
  groupId: GroupId,
): Promise<GetEnrollmentsResponse> =>
  http.get<GetEnrollmentsResponse>(Routes().edu.enrollments.find(), { groupId })

/**
 * One enrolment, for the sake of its student.
 *
 * `EnrollmentSummary` omits `studentId`, so the roster cannot name anybody from
 * the list alone and has to read each row. See the track report.
 */
export const getEnrollment = (http: HttpClient, id: EnrollmentId): Promise<GetEnrollmentResponse> =>
  http.get<GetEnrollmentResponse>(Routes().edu.enrollments.get(id))

/**
 * Names for the roster, and whether the list could be read at all.
 *
 * `refused` separates "may not read people" from "the school lists nobody",
 * which are the same empty map: the per-user route is gated on the same
 * `users:read`, so following up on an unnamed student is pointless after one.
 */
export interface SchoolUserNames {
  names: Map<UserId, string>
  refused: boolean
}

/**
 * Names for the students on the roster, in one request rather than one per row.
 *
 * Reading the user list needs `users:read`, which a teacher may not have, so a
 * refusal leaves the roster showing ids rather than failing the screen.
 */
export const getSchoolUserNames = async (
  http: HttpClient,
  schoolId: SchoolId,
): Promise<SchoolUserNames> => {
  try {
    const response = await http.get<GetUsersResponse>(Routes().edu.user().find(), { schoolId })
    return { names: new Map(response.items.map((user) => [user.id, user.name])), refused: false }
    // Refused or unreachable: the roster still lists who is in the group.
  } catch {
    return { names: new Map(), refused: true }
  }
}

/**
 * The name of one student the school list does not carry.
 *
 * `GET /edu/users` lists whoever holds a role, and an accepted student need
 * hold none: a place on a course is not a role. Quiet, because a refusal here
 * is not the screen's failure.
 */
export const getUserName = async (http: HttpClient, id: UserId): Promise<string | undefined> => {
  try {
    const user = await http.get<GetUserResponse>(Routes().edu.user(id).get(), undefined, {
      quiet: true,
    })
    return user.name
  } catch {
    return undefined
  }
}
