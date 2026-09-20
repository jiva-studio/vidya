import { registerAs } from '@nestjs/config'

export default registerAs('auth', () => ({
  /**
   * Time to live for the cached permissions of one user, in seconds. `0`
   * disables the cache.
   *
   * The cache is read when a token carries no permissions of its own, which is
   * only a token minted by a build older than this one; see
   * `AuthenticatedUserGuard`.
   */
  userPermissionsCacheTtl: parseInt(process.env.VIDYA_AUTH_USER_PERMISSIONS_CACHE_TTL ?? '0', 10),
}))
