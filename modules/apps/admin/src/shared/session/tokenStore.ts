/**
 * Where the refresh token lives between page loads.
 *
 * The access token is deliberately absent: it stays in memory for the life of
 * the tab, so a script that gets at local storage finds only the long-lived
 * token, and that one the server can revoke. Putting both here would hand over
 * a ready-to-use session instead.
 */
const REFRESH_TOKEN_KEY = 'vidya.admin.refreshToken'

const storage = (): Storage | undefined => {
  try {
    return window.localStorage
    // Storage throws rather than returns null when a browser has it disabled.
  } catch {
    return undefined
  }
}

export const readRefreshToken = (): string | undefined =>
  storage()?.getItem(REFRESH_TOKEN_KEY) ?? undefined

export const writeRefreshToken = (token: string): void => {
  storage()?.setItem(REFRESH_TOKEN_KEY, token)
}

export const clearRefreshToken = (): void => {
  storage()?.removeItem(REFRESH_TOKEN_KEY)
}

/**
 * Calls back when another tab drops the refresh token.
 *
 * The admin is kept open in two tabs. Signing out in one has to take the other
 * with it: otherwise the second tab keeps drawing a full menu over a session
 * the server has already forgotten.
 */
export const onRefreshTokenCleared = (handler: () => void): (() => void) => {
  const listener = (event: StorageEvent) => {
    if (event.key !== null && event.key !== REFRESH_TOKEN_KEY) return
    if (readRefreshToken() === undefined) handler()
  }

  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}

export const refreshTokenKey = REFRESH_TOKEN_KEY
