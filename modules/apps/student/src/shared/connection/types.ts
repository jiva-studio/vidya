import type { UserId } from '@vidya/domain'

/** What survives a reload: who the tokens belong to, and the token to renew. */
export interface StoredConnection {
  readonly ownerId: UserId
  readonly refreshToken: string
}
