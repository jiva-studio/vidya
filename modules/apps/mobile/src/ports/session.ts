/**
 * What the app keeps to stay signed in.
 *
 * There is no user id here on purpose: the API scopes a student's own data to
 * whoever holds the token, so the app never has to say who it is.
 */
export interface Session {
  readonly accessToken: string
  readonly refreshToken: string
}

/** Where the signed-in session lives between launches. */
export interface SessionStore {
  read(): Promise<Session | undefined>
  write(session: Session): Promise<void>
  clear(): Promise<void>
}
