import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DatabaseSuspendedError } from '@/ports'

/**
 * The lifecycle wiring — the second half of.
 *
 * The claim is narrow and worth stating on its own: **going into the background
 * releases the SQLite lock.** iOS kills an app that is still holding one when it
 * is suspended (`0xdead10cc`), and that death happens on a student's
 * handset and never in our logs, so there is no way to notice this by using the
 * app. The only way to know the listener is subscribed is to assert it.
 *
 * The first half — that a run interrupted this way resumes from the positions
 * it already committed — is tested against real SQLite in `usecases/sync`.
 */

const listeners = new Map<string, (event: unknown) => void>()
const removals: string[] = []

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, handler: (payload: unknown) => void) => {
      listeners.set(event, handler)
      return Promise.resolve({
        remove: () => {
          removals.push(event)
          return Promise.resolve()
        },
      })
    },
  },
}))

vi.mock('@capacitor/network', () => ({
  Network: {
    addListener: (event: string, handler: (payload: unknown) => void) => {
      listeners.set(event, handler)
      return Promise.resolve({ remove: () => Promise.resolve() })
    },
  },
}))

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: () => Promise.resolve({ value: 'device-a' }),
    set: () => Promise.resolve(),
    remove: () => Promise.resolve(),
  },
}))

const { openTestDatabase } = await import('@/infra/persistence/testing')
const { startSync } = await import('../sync')

describe('the sync lifecycle wiring', () => {
  beforeEach(() => {
    listeners.clear()
    removals.length = 0
  })

  const started = async () => {
    const { db } = await openTestDatabase()
    const sync = await startSync({ db, ownerId: () => 'owner-a' })
    return { db, sync }
  }

  it('subscribes to every event that decides when a run happens', async () => {
    await started()

    expect([...listeners.keys()].sort()).toEqual([
      'appStateChange',
      'networkStatusChange',
      'pause',
      'resume',
    ])
  })

  it('going into the background releases the lock', async () => {
    const { db } = await started()

    // Before: the database takes transactions.
    await expect(db.transaction(async () => undefined)).resolves.toBeUndefined()

    await listeners.get('pause')!(undefined)

    // After: it refuses, rather than holding a lock the system will punish.
    await expect(db.transaction(async () => undefined)).rejects.toThrow(DatabaseSuspendedError)
  })

  it('coming back to the foreground takes transactions again', async () => {
    const { db } = await started()

    await listeners.get('appStateChange')!({ isActive: false })
    await expect(db.transaction(async () => undefined)).rejects.toThrow(DatabaseSuspendedError)

    await listeners.get('resume')!(undefined)
    await expect(db.transaction(async () => undefined)).resolves.toBeUndefined()
  })

  it('an inactive appStateChange suspends, an active one resumes', async () => {
    const { db } = await started()

    await listeners.get('appStateChange')!({ isActive: false })
    await expect(db.transaction(async () => undefined)).rejects.toThrow(DatabaseSuspendedError)

    await listeners.get('appStateChange')!({ isActive: true })
    await expect(db.transaction(async () => undefined)).resolves.toBeUndefined()
  })

  it('stopping unsubscribes everything and leaves the lock released', async () => {
    const { db, sync } = await started()

    await sync.triggers.stop()

    expect(removals.sort()).toEqual(['appStateChange', 'pause', 'resume'])
    await expect(db.transaction(async () => undefined)).rejects.toThrow(DatabaseSuspendedError)
  })
})
