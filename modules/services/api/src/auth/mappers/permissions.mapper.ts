import * as dto from '@vidya/api/auth/dto'
import * as entities from '@vidya/entities'

/**
 * Roles as the access token carries them.
 *
 * The names shorten deliberately — `sid` and `p` ride in every request's JWT,
 * and the full words cost bytes on every call for no reader's benefit.
 */
export const toUserPermissions = (roles: entities.Role[]): dto.UserPermission[] =>
  roles.map((role) => ({ sid: role.schoolId, p: role.permissions }))
