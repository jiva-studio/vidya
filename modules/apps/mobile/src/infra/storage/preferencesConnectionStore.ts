import { Preferences } from '@capacitor/preferences'

import type { Connection, IConnectionStore } from '@/ports'

const KEY = 'connections'

/**
 * The servers the app is signed in to, kept in the platform store.
 *
 * Written as one record rather than one key per connection: the list is read
 * whole at launch and is never long, and a single value cannot be caught
 * half-written between two keys.
 */
export class PreferencesConnectionStore implements IConnectionStore {
  async list(): Promise<readonly Connection[]> {
    const { value } = await Preferences.get({ key: KEY })
    if (!value) return []
    return JSON.parse(value) as Connection[]
  }

  async add(connection: Connection): Promise<void> {
    const rows = await this.list()
    await this.write([...rows.filter((row) => row.baseUrl !== connection.baseUrl), connection])
  }

  async update(baseUrl: string, changes: Partial<Omit<Connection, 'baseUrl'>>): Promise<void> {
    const rows = await this.list()
    await this.write(rows.map((row) => (row.baseUrl === baseUrl ? { ...row, ...changes } : row)))
  }

  async remove(baseUrl: string): Promise<void> {
    const rows = await this.list()
    await this.write(rows.filter((row) => row.baseUrl !== baseUrl))
  }

  private async write(rows: readonly Connection[]): Promise<void> {
    await Preferences.set({ key: KEY, value: JSON.stringify(rows) })
  }
}
