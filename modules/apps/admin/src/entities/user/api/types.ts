import type { SchoolId } from '@vidya/domain'

/**
 * The schools a user belongs to, as `/edu/users/:id/schools` answers them.
 *
 * `@vidya/protocol` carries no type for this resource, so the wire shape is
 * mirrored here. The field is named `userSchools` by the API.
 */
export interface GetUserSchoolsResponse {
  userSchools: SchoolId[]
}

/** One page of the people list, as the screen asks for it. */
export interface UserPageQuery {
  limit?: number
  offset?: number
  search?: string
}
