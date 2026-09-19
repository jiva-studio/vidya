import * as dto from '@vidya/api/edu/dto'
import * as domain from '@vidya/domain'
import * as entities from '@vidya/entities'

import { project, projectAll } from './project'

/* -------------------------------------------------------------------------- */
/*                                   Fields                                   */
/* -------------------------------------------------------------------------- */

const ROLE = ['id', 'name', 'description', 'permissions'] as const
const ROLE_SUMMARY = ['id', 'name', 'description'] as const
const SCHOOL = ['id', 'name', 'logoUrl', 'description'] as const
const SCHOOL_SUMMARY = ['id', 'name', 'logoUrl'] as const
const USER = ['id', 'name', 'email', 'phone'] as const
const USER_SUMMARY = ['id', 'name'] as const

/* -------------------------------------------------------------------------- */
/*                                    Roles                                   */
/* -------------------------------------------------------------------------- */

export const toRoleDetails = (r: entities.Role) => project<dto.RoleDetails>(r, ROLE)
export const toRoleSummaries = (r: entities.Role[]) => projectAll<dto.RoleSummary>(r, ROLE_SUMMARY)

/** The role reference a user carries: the role's own id under a clearer name. */
export const toUserRoles = (roles: entities.Role[]): dto.UserRole[] =>
  roles.map((r) => ({ roleId: r.id }))

/* -------------------------------------------------------------------------- */
/*                                   Schools                                  */
/* -------------------------------------------------------------------------- */

export const toSchoolDetails = (s: entities.School) => project<dto.SchoolDetails>(s, SCHOOL)
export const toSchoolSummaries = (s: entities.School[]) =>
  projectAll<dto.SchoolSummary>(s, SCHOOL_SUMMARY)

/* -------------------------------------------------------------------------- */
/*                                    Users                                   */
/* -------------------------------------------------------------------------- */

export const toUserDetails = (u: entities.User) => project<dto.UserDetails>(u, USER)
export const toUserSummaries = (u: entities.User[]) => projectAll<dto.UserSummary>(u, USER_SUMMARY)

/* -------------------------------------------------------------------------- */
/*                                   Shared                                   */
/* -------------------------------------------------------------------------- */

export const toId = <TId extends domain.Id<string>>(e: { id: TId }) => ({ id: e.id })
