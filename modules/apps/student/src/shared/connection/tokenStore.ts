import type { UserId } from '@vidya/domain'
import { asId } from '@vidya/domain'

import type { StoredConnection } from './types'

/**
 * Where the refresh token lives between page loads.
 *
 * The access token is deliberately absent: it stays in memory for the life of
 * the tab, so a script that gets at local storage finds only the long-lived
 * token, and that one the server can revoke. The owner's id is beside it
 * because every row of the local database is keyed by it, and asking the
 * server who the bearer is would be a request made before there is a token to
 * make it with.
 */
const CONNECTION_KEY = 'vidya.student.connection'

const storage = (): Storage | undefined => {
  try {
    return window.localStorage
    // Storage throws rather than returns null when a browser has it disabled.
  } catch {
    return undefined
  }
}

export const readStored = (): StoredConnection | undefined => {
  const raw = storage()?.getItem(CONNECTION_KEY)
  if (!raw) return undefined

  try {
    const parsed = JSON.parse(raw) as { ownerId?: string; refreshToken?: string }
    if (!parsed.ownerId || !parsed.refreshToken) return undefined

    return { ownerId: asId<UserId>(parsed.ownerId), refreshToken: parsed.refreshToken }
    // Anything unreadable is treated as nobody being signed in: the visitor
    // signs in again, which is recoverable, where a throw at start-up is not.
  } catch {
    return undefined
  }
}

export const writeStored = (connection: StoredConnection): void => {
  storage()?.setItem(CONNECTION_KEY, JSON.stringify(connection))
}

export const clearStored = (): void => {
  storage()?.removeItem(CONNECTION_KEY)
}
