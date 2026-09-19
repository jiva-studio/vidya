import type { EnrollmentId, HomeworkId, LessonVersionId, SchoolId, SectionId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DatabaseSuspendedError } from '@/ports'
import {
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
} from '@/usecases/sync/__tests__/fakeSyncServer'

import { inMemoryConnectionStore } from './connectionFixtures'
import { fakeSyncNetwork } from './fakeSyncNetwork'

/**
 * The registry of servers the app is signed in to.
 *
 * Two claims are load-bearing here and neither is visible by using the app.
 *
 * **`ownerId` comes from the server, not from the token.** It keys every table
 * on the device, and the same person on two servers is two different ids. A
 * sign-in that skipped the profile call would leave the engine guessing, and
 * the guess would only show as rows filed under nobody.
 *
 * **Signing out is not a delete.** The triggers stop and the SQLite lock is
 * given back, but the outbox keeps every row: the student's unsent answers are
 * theirs whether or not they are signed in at this moment.
 */

const platform = vi.hoisted(() => new Map<string, string>())

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) =>
      Promise.resolve({ value: platform.get(key) ?? (key === 'device-id' ? 'device-a' : null) }),
    set: ({ key, value }: { key: string; value: string }) => {
      platform.set(key, value)
      return Promise.resolve()
    },
    remove: ({ key }: { key: string }) => {
      platform.delete(key)
      return Promise.resolve()
    },
  },
}))

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

const SCHOOL_A = 'https://school-a.test'
const SCHOOL_B = 'https://school-b.test'

const network = fakeSyncNetwork()

/** The registry as the running app holds it, freshly imported. */
const registry = async () => {
  const { useConnections } = await import('../connections')
  const connections = useConnections()
  await connections.restore()
  return connections
}

describe('the connection registry', () => {
  beforeEach(() => {
    platform.clear()
    listeners.clear()
    removals.length = 0
    vi.resetModules()
    network.install()
    network.add(SCHOOL_A, 'owner-a')
    network.add(SCHOOL_B, 'owner-b')
  })

  afterEach(() => {
    network.restore()
  })

  const signIn = async (baseUrl: string) => {
    const server = network.server(baseUrl)
    const connections = await registry()
    await connections.signIn({
      baseUrl,
      session: { accessToken: server.accessToken, refreshToken: server.refreshToken },
    })
    return connections
  }

  it('signing in asks the server who the bearer is', async () => {
    const connections = await signIn(SCHOOL_A)

    const profileCalls = network
      .requestsTo(SCHOOL_A)
      .filter((request) => request.path === '/auth/profile')
    expect(profileCalls).toHaveLength(1)
    expect(profileCalls[0]!.token).toBe('access-owner-a')

    expect(connections.connections.value[0]!.ownerId).toBe('owner-a')
  })

  it('signing in reaches the address being signed in to and no other', async () => {
    await signIn(SCHOOL_B)

    // Not a default base URL, and not the school already signed in: the
    // transport is built from the address the sign-in names.
    expect(network.strays).toEqual([])
    expect(network.requestsTo(SCHOOL_A)).toEqual([])
    expect(network.requestsTo(SCHOOL_B).map((request) => request.path)).toEqual(['/auth/profile'])
  })

  it('the same server spelled two ways stays one connection', async () => {
    const connections = await signIn(SCHOOL_A)
    const server = network.server(SCHOOL_A)

    await connections.signIn({
      baseUrl: `${SCHOOL_A}/`,
      session: { accessToken: server.accessToken, refreshToken: server.refreshToken },
    })

    expect(connections.connections.value).toHaveLength(1)
  })

  it('a connection survives a relaunch with its address, identity and both tokens', async () => {
    await signIn(SCHOOL_A)
    await signIn(SCHOOL_B)

    // A relaunch: nothing in memory, everything in the platform store.
    vi.resetModules()
    const relaunched = await registry()

    expect([...relaunched.connections.value].map((row) => ({ ...row }))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          baseUrl: SCHOOL_A,
          ownerId: 'owner-a',
          session: { accessToken: 'access-owner-a', refreshToken: 'refresh-owner-a' },
        }),
        expect.objectContaining({
          baseUrl: SCHOOL_B,
          ownerId: 'owner-b',
          session: { accessToken: 'access-owner-b', refreshToken: 'refresh-owner-b' },
        }),
      ]),
    )
  })

  it('a connection that needs a new sign-in is still one after a relaunch', async () => {
    const connections = await signIn(SCHOOL_A)
    await connections.markNeedsSignIn(SCHOOL_A)

    vi.resetModules()
    const relaunched = await registry()

    expect(relaunched.connections.value[0]!.needsSignIn).toBe(true)
  })

  it('signing out stops the triggers, gives the lock back and keeps every queued row', async () => {
    const connections = await signIn(SCHOOL_A)

    const { openTestDatabase } = await import('@/infra/persistence/testing')
    const { startSync } = await import('../sync')
    const { db } = await openTestDatabase()

    const connection = connections.connections.value[0]!
    const sync = await startSync({
      db,
      connection,
      connections: inMemoryConnectionStore([connection]),
    })

    await sync.engine.homework.saveAnswer({
      id: asId<HomeworkId>(HOMEWORK_ID),
      schoolId: asId<SchoolId>(SCHOOL_ID),
      enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
      lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
      sectionId: asId<SectionId>(SECTION_ID),
      text: 'answered before signing out',
    })

    const before = await db.query<{ total: number }>('SELECT COUNT(*) AS total FROM outbox')

    await connections.signOut(SCHOOL_A)

    expect(removals.sort()).toEqual(['appStateChange', 'pause', 'resume'])
    await expect(db.transaction(async () => undefined)).rejects.toThrow(DatabaseSuspendedError)

    const after = await db.query<{ total: number }>('SELECT COUNT(*) AS total FROM outbox')
    expect(Number(after[0]!.total)).toBe(Number(before[0]!.total))
    expect(Number(after[0]!.total)).toBeGreaterThan(0)
  })
})
