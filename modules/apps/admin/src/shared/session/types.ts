import type { PermissionKey, SchoolId } from '@vidya/domain'
import type { UserPermission } from '@vidya/protocol'

/** What the application keeps about the signed-in user while a tab is open. */
export interface SessionTokens {
  readonly accessToken: string
  readonly refreshToken: string
}

/** The claims the admin reads out of an access token. Nothing here is trusted. */
export interface AccessTokenClaims {
  readonly sub: string
  readonly exp: number
  readonly permissions: UserPermission[]
}

export type { PermissionKey, SchoolId, UserPermission }
