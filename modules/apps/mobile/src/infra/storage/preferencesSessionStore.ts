import { Preferences } from '@capacitor/preferences'

import type { Session, SessionStore } from '@/ports'

const KEY = 'session'

/**
 * The session outlives the process, so it cannot live in memory. Capacitor
 * Preferences is the platform's own store and needs no database.
 */
export class PreferencesSessionStore implements SessionStore {
  async read(): Promise<Session | undefined> {
    const { value } = await Preferences.get({ key: KEY })
    if (!value) return undefined
    return JSON.parse(value) as Session
  }

  async write(session: Session): Promise<void> {
    await Preferences.set({ key: KEY, value: JSON.stringify(session) })
  }

  async clear(): Promise<void> {
    await Preferences.remove({ key: KEY })
  }
}
