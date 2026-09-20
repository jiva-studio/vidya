import { UserId } from '@vidya/domain'

/**
 * Forgets what was cached about a user's permissions.
 *
 * A role grant lives in `edu` — assigning it, revoking it, deleting the role,
 * rewriting what it allows. The cache it invalidates is `auth`'s: keyed,
 * written and read by `AuthUsersService` alone. `edu` has no business knowing
 * that key's shape or holding a Redis client to reach it, so this is the one
 * instruction it is allowed to give instead: forget these people, the truth
 * about them changed underneath you.
 *
 * The implementation lives where the cache lives and is bound to this token in
 * the composition root, which is the only place allowed to know both sides —
 * the same shape `sync`'s `SchoolMembership` port uses to ask a question of
 * `edu` without importing it.
 */
export interface PermissionsCacheEviction {
  evict(userIds: UserId[]): Promise<void>
}

/** Injection token for {@link PermissionsCacheEviction}. */
export const PERMISSIONS_CACHE_EVICTION = Symbol('PermissionsCacheEviction')
