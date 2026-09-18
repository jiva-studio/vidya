import type { UserId } from '@vidya/domain'

export interface Session {
  readonly userId: UserId
  readonly accessToken: string
  readonly refreshToken: string
}

/** Where the signed-in session lives between launches. */
export interface SessionStore {
  read(): Promise<Session | undefined>
  write(session: Session): Promise<void>
  clear(): Promise<void>
}
