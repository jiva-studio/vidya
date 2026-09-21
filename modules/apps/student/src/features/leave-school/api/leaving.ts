import type { HttpClient } from '@vidya/client'
import type { SchoolId, UserId } from '@vidya/domain'
import { Routes } from '@vidya/protocol'

/**
 * The one request leaving makes, and why it is not synchronisation.
 *
 * Membership is granted by a role, and a role is not a synchronised
 * collection: the device learns that a school is gone when the next run finds
 * the scope revoked. The answer says how many places went with the departure,
 * and it arrives after they are already gone — which is why the screen says
 * what it will cost before the call rather than after it.
 */
export const leaveSchool = (http: HttpClient, userId: UserId, schoolId: SchoolId): Promise<void> =>
  http.delete(Routes().edu.user(userId).schools.delete(schoolId))
