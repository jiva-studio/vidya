import type { HttpClient } from '@vidya/client'
import type { SchoolId, UserId } from '@vidya/domain'
import type { ResolveSchoolResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

/**
 * The two requests joining makes, and why they are not synchronisation.
 *
 * Both of them happen before a membership exists. The card is shown to a
 * stranger who has no session and no local database, and joining is what
 * creates the scope the school's own data then arrives in. Afterwards nothing
 * here is asked again: the catalogue, the courses and the lessons all come
 * down with the rest — see `app/__tests__/networkBoundary.spec.ts`.
 */
export const resolveSchool = (http: HttpClient, code: string): Promise<ResolveSchoolResponse> =>
  http.get<ResolveSchoolResponse>(Routes().join.resolve(code))

/** The body `AddUserSchoolsRequest` describes; the wire has no shared type for it. */
interface JoinSchoolBody {
  readonly schoolId: SchoolId
}

/** Answers with the membership the server recorded, or raises what it refused. */
export const joinSchool = async (
  http: HttpClient,
  userId: UserId,
  schoolId: SchoolId,
): Promise<void> => {
  await http.post(Routes().edu.user(userId).schools.create(), {
    schoolId,
  } satisfies JoinSchoolBody)
}
