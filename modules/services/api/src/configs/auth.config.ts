import { registerAs } from '@nestjs/config'

export default registerAs('auth', () => ({
  /**
   * Time to live for the user permissions cache in seconds.
   * Set to 0 to disable caching for development purposes
   * for example.
   *
   * Every token carries the permissions it was minted with, so this
   * only covers the reads that mint one — signing in and refreshing —
   * and tokens issued before the claim existed.
   */
  userPermissionsCacheTtl: parseInt(process.env.VIDYA_AUTH_USER_PERMISSIONS_CACHE_TTL ?? '0', 10),
}))
