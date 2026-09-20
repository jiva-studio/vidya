import type {
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  SchoolId,
  SectionId,
  UserId,
} from '@vidya/domain'
import { asId } from '@vidya/domain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DatabaseSuspendedError } from '@/ports'
import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
} from '@/usecases/sync/__tests__/fakeSyncServer'

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
const { startSync, stopSync, WRITE_DEBOUNCE_MS } = await import('../sync')
const { hasSynced } = await import('../deviceSync')
const { NoConnectionError, useRepositories } = await import('../repositories')

const SCHOOL_A = 'https://school-a.test'
const SCHOOL_B = 'https://school-b.test'

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

  it('signing out of one school leaves the other school working', async () => {
    const { db, connection, connections } = await wired()
    const second = network.add(SCHOOL_B, 'owner-b')

    await startSync({ db, connection, connections })
    await startSync({ db, connection: connectionTo(SCHOOL_B, second), connections })

    // One school left; the other is still syncing, and the lock is its to use.
    await stopSync(SCHOOL_A)
    await expect(db.transaction(async () => undefined)).resolves.toBeUndefined()

    await stopSync(SCHOOL_B)
    await expect(db.transaction(async () => undefined)).rejects.toThrow(DatabaseSuspendedError)
  })

  it('a run asked for while the app is in the background never starts', async () => {
    const { db, connection, connections } = await wired()
    const started = await startSync({ db, connection, connections })

    await stopSync(SCHOOL_A)

    // The network coming back in the background asks for a run. It must find
    // the database already handed over rather than open a transaction on it.
    const result = await started.triggers.now()

    expect(result.outcome).toBe('paused')
    expect(network.requestsTo(SCHOOL_A)).toEqual([])
  })

  it('a local write asks for a run of its own accord, once the typing stops', async () => {
    vi.useFakeTimers()

    try {
      const { db, connection, connections } = await wired()
      await startSync({ db, connection, connections })

      await useRepositories().homework.saveAnswer({
        id: asId<HomeworkId>(HOMEWORK_ID),
        schoolId: asId<SchoolId>(SCHOOL_ID),
        enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
        lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
        sectionId: asId<SectionId>(SECTION_ID),
        text: 'the vowels come first',
      })

      // Not at once: a lesson answered block by block would be one run per
      // block, and the student is still typing.
      expect(network.requestsTo(SCHOOL_A)).toEqual([])

      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS)
      expect(network.requestsTo(SCHOOL_A).length).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
      await stopSync(SCHOOL_A)
    }
  })

  it('a device that has read from this server before says so before the first run', async () => {
    const { db, connection, connections } = await wired()
    const started = await startSync({ db, connection, connections })

    // Nothing has ever arrived: the screens are owed "getting your courses
    // ready" rather than an empty list.
    expect(await hasSynced(started.engine)).toBe(false)

    network.server(SCHOOL_A).sync.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: { id: COURSE_ID, schoolId: SCHOOL_ID, name: 'Bhagavad-gita', learningType: 'group' },
    })
    await started.triggers.now()

    // A scope position outlives the launch that wrote it, so the next launch
    // knows the courses are already on the device — even with no network to
    // ask, which is exactly when the promise of a first run cannot be kept.
    expect(await hasSynced(started.engine)).toBe(true)

    await stopSync(SCHOOL_A)
  })

  it('a connection waiting for a sign-in does not go to the network at all', async () => {
    const { db, connection, connections } = await wired()
    const stranded = { ...connection, needsSignIn: true }

    const started = await startSync({ db, connection: stranded, connections })
    const result = await started.triggers.now()

    // Two requests to be told twice that the token is dead is what the flag
    // exists to prevent; the device stays readable meanwhile.
    expect(result.outcome).toBe('deferred')
    expect(network.requestsTo(SCHOOL_A)).toEqual([])

    await stopSync(SCHOOL_A)
  })

  it('signing in again hands the running engine the new session', async () => {
    const { db, connection, connections } = await wired()
    const server = network.server(SCHOOL_A)

    // Stranded, and holding a session the server will not accept.
    const started = await startSync({
      db,
      connection: {
        ...connection,
        needsSignIn: true,
        session: { accessToken: 'dead-access', refreshToken: 'dead-refresh' },
      },
      connections,
    })
    expect((await started.triggers.now()).outcome).toBe('deferred')

    // The repair: the same person signs in to the same school again, and the
    // engine already listening is the one that has to carry the new token.
    const revived = await startSync({ db, connection, connections })

    expect(revived).toBe(started)
    expect((await revived.triggers.now()).outcome).toBe('completed')

    const tokens = new Set(network.requestsTo(SCHOOL_A).map((request) => request.token))
    expect([...tokens]).toEqual([server.accessToken])

    await stopSync(SCHOOL_A)
  })

  it('the running engine is what the screens read through', async () => {
    const { db, connection, connections } = await wired()
    const started = await startSync({ db, connection, connections })

    expect(useRepositories().courses).toBe(started.engine.courses)

    await stopSync(SCHOOL_A)
    expect(useRepositories().courses).not.toBe(started.engine.courses)
  })
})
