import { ForbiddenException } from '@nestjs/common'
import { AuthenticatedUserPermissions } from '@vidya/api/auth/utils'
import * as domain from '@vidya/domain'

/**
 * Refuses unless every permission requested is one the caller already holds
 * in the target school.
 *
 * Holding `roles:create` (or `roles:update`) only proves the caller may shape
 * roles in a school, not that they may grant any permission that exists.
 * Without this, a caller holding `roles:create` plus one editable permission
 * could grant a role every permission in the catalogue: create it, assign it
 * to themselves via `POST /edu/users/:userId/roles`, and sign in again for a
 * token that carries it.
 *
 * The check is against what the caller holds right now, never against a
 * role's previous permissions — a caller who removes one permission and adds
 * another they lack must not slip through on the difference. Callers pass
 * only the requested set, not the role being edited, so there is nothing here
 * to smuggle that comparison back in.
 *
 * A caller holding `'*'` in the school passes every check, so the `Owner`
 * role keeps working.
 *
 * This belongs below the controller, not inside it, so that every caller —
 * including the offline sync endpoints, which do not go through one — gets
 * it too (see the comment above `RolesService.assertRolesWithin`). It lives
 * here, in `validations/`, and is called explicitly from the controller
 * rather than from `RolesService` only because that service is being edited
 * by a parallel change; it should move behind `RolesService.create` /
 * `updateOneBy` once that change lands.
 */
export function assertPermissionsGrantable(
  requested: domain.PermissionKey[],
  schoolId: domain.SchoolId,
  callerPermissions: AuthenticatedUserPermissions,
): void {
  const ungranted = requested.filter(
    (permission) => !callerPermissions.has([permission], { schoolId }),
  )

  if (ungranted.length > 0) {
    throw new ForbiddenException('User does not have permission')
  }
}
