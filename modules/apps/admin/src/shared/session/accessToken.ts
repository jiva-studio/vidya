import type { PermissionKey, SchoolId } from '@vidya/domain'

import type { AccessTokenClaims, UserPermission } from './types'

const ALL: PermissionKey = '*'

const decodePayload = (segment: string): unknown => {
  const padded = segment.replaceAll('-', '+').replaceAll('_', '/')
  return JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)))
}

/**
 * Reads the claims out of an access token without verifying it.
 *
 * Verification is the server's job on every request; the only thing done with
 * this is deciding which menu items to draw, and a forged token buys nothing
 * but a menu whose every entry is refused.
 */
export const readAccessToken = (token: string | undefined): AccessTokenClaims | undefined => {
  if (!token) return undefined

  const segments = token.split('.')
  if (segments.length !== 3) return undefined

  try {
    const claims = decodePayload(segments[1]) as Partial<AccessTokenClaims>
    if (typeof claims?.sub !== 'string' || typeof claims?.exp !== 'number') return undefined
    return { sub: claims.sub, exp: claims.exp, permissions: claims.permissions ?? [] }
    // A token that is not a token tells us the same thing as no token at all.
  } catch {
    return undefined
  }
}

/** `nowSeconds` is passed in because this layer may not read the clock itself. */
export const hasExpired = (claims: AccessTokenClaims | undefined, nowSeconds: number): boolean =>
  claims === undefined || claims.exp <= nowSeconds

/** The schools the token grants anything in, in the order the token lists them. */
export const schoolsOf = (permissions: UserPermission[]): SchoolId[] =>
  permissions.map((entry) => entry.sid)

/** Whether the token grants `permission` in that one school. `'*'` grants everything. */
export const grants = (
  permissions: UserPermission[],
  schoolId: SchoolId | undefined,
  permission: PermissionKey,
): boolean => {
  if (!schoolId) return false
  const held = permissions.find((entry) => entry.sid === schoolId)?.p
  if (!held) return false
  return held.includes(ALL) || held.includes(permission)
}
