import type { EnrollmentId, UserId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DatabaseSuspendedError } from '@/ports'

import { connectionTo, inMemoryConnectionStore } from './connectionFixtures'
import { fakeSyncNetwork } from './fakeSyncNetwork'

/**
 * One engine per server, and what it costs to get that wrong.
 *
 * Signing in to a second school re-reads the whole registry, so a connection
 * that is already running is asked to start again. A second engine over the
 * same server would stay subscribed to the lifecycle events with nothing
 * holding a handle to it, would keep its place in the count that decides when
 * the SQLite lock goes back, and — after another person signed in on the same
 * server — would go on pulling and pushing under the previous identity.
 *
 * The platform doubles here keep **every** registration, not the last one per
 * event: a double that maps an event to one handler hides the very duplicate
 * this file is about.
 */

const registrations: string[] = []
const removals: string[] = []

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string) => {
      registrations.push(event)
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
    addListener: (event: string) => {
      registrations.push(event)
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
const { startSync, stopSync } = await import('../sync')
const { NoConnectionError, useRepositories } = await import('../repositories')

const SCHOOL_A = 'https://school-a.test'

const network = fakeSyncNetwork()

const wired = async () => {
  const { db } = await openTestDatabase()
  const server = network.add(SCHOOL_A, 'owner-a')
  const connection = connectionTo(SCHOOL_A, server)

  return { db, connection, connections: inMemoryConnectionStore([connection]) }
}

const pauses = () => registrations.filter((event) => event === 'pause')

describe('one engine per server', () => {
  beforeEach(() => {
    registrations.length = 0
    removals.length = 0
    network.install()
  })

  afterEach(() => {
    network.restore()
  })

  // First, while nothing has been started in this file: a screen mounted
  // before the engines are up must not take itself down.
  it('reads an empty device while no connection is running, and refuses to write', async () => {
    const repositories = useRepositories()

    await expect(repositories.courses.list()).resolves.toEqual([])
    await expect(repositories.schools.list()).resolves.toEqual([])
    await expect(repositories.lessonVersions.getPublished(asId('lesson'))).resolves.toBeNull()

    await expect(repositories.enrollments.withdraw(asId<EnrollmentId>('e1'))).rejects.toThrow(
      NoConnectionError,
    )
  })

  it('starting the same server twice subscribes once and hands back the same engine', async () => {
    const { db, connection, connections } = await wired()

    const first = await startSync({ db, connection, connections })
    const second = await startSync({ db, connection, connections })

    expect(second).toBe(first)
    expect(pauses()).toHaveLength(1)

    // One stop releases the lock, because only one engine was ever counted.
    await stopSync(SCHOOL_A)
    await expect(db.transaction(async () => undefined)).rejects.toThrow(DatabaseSuspendedError)
  })

  it('another identity on the same server replaces the engine rather than joining it', async () => {
    const { db, connection, connections } = await wired()

    await startSync({ db, connection, connections })
    const next = { ...connection, ownerId: asId<UserId>('owner-b') }
    await startSync({ db, connection: next, connections })

    // The first engine was taken down rather than left listening.
    expect(removals.filter((event) => event === 'pause')).toHaveLength(1)
    expect(pauses()).toHaveLength(2)

    await stopSync(SCHOOL_A)
    await expect(db.transaction(async () => undefined)).rejects.toThrow(DatabaseSuspendedError)
  })

  it('the running engine is what the screens read through', async () => {
    const { db, connection, connections } = await wired()
    const started = await startSync({ db, connection, connections })

    expect(useRepositories().courses).toBe(started.engine.courses)

    await stopSync(SCHOOL_A)
    expect(useRepositories().courses).not.toBe(started.engine.courses)
  })
})
