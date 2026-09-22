import type { IConnectionStore, IDatabase } from '@vidya/client'
import { DatabaseSuspendedError } from '@vidya/client'
import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
  USER_SCOPE,
} from '@vidya/client/testing'
import type { EnrollmentId, HomeworkId, LessonVersionId, SchoolId, SectionId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { connectionTo, inMemoryConnectionStore } from './connectionFixtures'
import { fakeSyncNetwork, ticks } from './fakeSyncNetwork'

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
 *
 * The rest of this file is about a handset that talks to more than one server.
 * Two connections mean two engines over one database, and everything that can
 * go wrong there — a token sent to the wrong address, two transactions in one
 * file, a watermark that counts someone else's rows — is silent on the device
 * and permanent in the data.
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

const { openTestDatabase } = await import('@vidya/client/testing')
const { startSync } = await import('../sync')

const SCHOOL_A = 'https://school-a.test'
const SCHOOL_B = 'https://school-b.test'

const network = fakeSyncNetwork()

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

const course = (name: string) => ({
  id: COURSE_ID,
  schoolId: SCHOOL_ID,
  name,
  learningType: 'group',
})

interface Wired {
  readonly db: IDatabase
  readonly connections: IConnectionStore
  readonly a: Awaited<ReturnType<typeof startSync>>
  readonly b: Awaited<ReturnType<typeof startSync>>
}

describe('the sync lifecycle wiring', () => {
  beforeEach(() => {
    listeners.clear()
    removals.length = 0
    network.install()
  })

  afterEach(() => {
    network.restore()
  })

  const started = async () => {
    const { db } = await openTestDatabase()
    const server = network.add(SCHOOL_A, 'owner-a')
    const connection = connectionTo(SCHOOL_A, server)
    const connections = inMemoryConnectionStore([connection])
    const sync = await startSync({ db, connection, connections })

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

/* -------------------------------------------------------------------------- */
/*                           Two servers, one handset                         */
/* -------------------------------------------------------------------------- */

describe('two connections on one handset', () => {
  beforeEach(() => {
    listeners.clear()
    removals.length = 0
    network.install()
  })

  afterEach(() => {
    network.restore()
  })

  /** Both schools wired over one database, each with a course to hand out. */
  const wired = async (): Promise<Wired> => {
    const { db } = await openTestDatabase()

    const serverA = network.add(SCHOOL_A, 'owner-a')
    const serverB = network.add(SCHOOL_B, 'owner-b')

    serverA.sync.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course('Bhagavad-gita'),
    })
    serverB.sync.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course('Sri Isopanisad'),
    })

    const one = connectionTo(SCHOOL_A, serverA)
    const two = connectionTo(SCHOOL_B, serverB)
    const connections = inMemoryConnectionStore([one, two])

    return {
      db,
      connections,
      a: await startSync({ db, connection: one, connections }),
      b: await startSync({ db, connection: two, connections }),
    }
  }

  it('each engine talks only to its own server, and only with its own token', async () => {
    const { a, b } = await wired()

    await a.triggers.now()
    await b.triggers.now()

    expect(network.requestsTo(SCHOOL_A)).not.toHaveLength(0)
    expect(network.requestsTo(SCHOOL_B)).not.toHaveLength(0)

    for (const request of network.requestsTo(SCHOOL_A)) {
      expect(request.token).toBe('access-owner-a')
    }
    for (const request of network.requestsTo(SCHOOL_B)) {
      expect(request.token).toBe('access-owner-b')
    }

    // Nothing reached a default address: the transport is built from the
    // connection it serves and knows no other.
    expect(network.strays).toEqual([])
  })

  it('a school gets the course of its own server and not the other one', async () => {
    const { a, b } = await wired()

    await a.triggers.now()
    await b.triggers.now()

    expect((await a.engine.courses.list()).map((row) => row.name)).toEqual(['Bhagavad-gita'])
    expect((await b.engine.courses.list()).map((row) => row.name)).toEqual(['Sri Isopanisad'])
  })

  it('runs started together are serialised rather than interleaved', async () => {
    const { a, b } = await wired()

    const results = await Promise.all([a.triggers.now(), b.triggers.now()])

    for (const result of results) {
      expect(String(result.failure ?? '')).not.toMatch(/database is locked/i)
    }

    // One address, then the other: a second run waited instead of opening a
    // transaction of its own against the same file.
    const addresses = network.requests.map((request) => request.baseUrl)
    const switches = addresses.filter((value, index) => index > 0 && value !== addresses[index - 1])
    expect(switches).toHaveLength(1)
  })

  /**
   * A handset put away while a page is in flight, with a second page to come
   * and a second connection waiting its turn.
   *
   * `atPause` is what had already left the device when the system took it
   * back; everything after is measured against that line.
   */
  const putAwayMidPull = async () => {
    const wiring = await wired()

    const serverA = network.server(SCHOOL_A)
    serverA.sync.pageSize = 1
    serverA.sync.journal({
      collection: 'enrollments',
      docId: ENROLLMENT_ID,
      scope: USER_SCOPE,
      data: {
        id: ENROLLMENT_ID,
        schoolId: SCHOOL_ID,
        courseId: COURSE_ID,
        studentId: 'owner-a',
        status: 'accepted',
        createdAt: '2026-09-18T00:00:00.000Z',
      },
    })

    let atPause = 0
    serverA.sync.onPull = async () => {
      serverA.sync.onPull = null
      atPause = network.requests.length
      await listeners.get('pause')!(undefined)
    }

    const results = await Promise.all([wiring.a.triggers.now(), wiring.b.triggers.now()])

    return { ...wiring, results, atPause: () => atPause }
  }

  it('going into the background drops the queued run and gives the lock back', async () => {
    const { db, a, results } = await putAwayMidPull()

    // The page already fetched was carried to its commit — dropping it would
    // only mean downloading it again.
    expect(await a.engine.courses.getById(asId(COURSE_ID))).not.toBeNull()

    // The run that was waiting was cancelled rather than started behind the
    // suspension, so there was nothing for the lock to wait on.
    expect(results[1]!.outcome).toBe('paused')
    expect(network.requestsTo(SCHOOL_B)).toEqual([])

    await expect(db.transaction(async () => undefined)).rejects.toThrow(DatabaseSuspendedError)
  })

  it('nothing new leaves the device once it has gone into the background', async () => {
    const { atPause } = await putAwayMidPull()

    // The scope had a second page to give. Asking for it costs a request made
    // by an app the system is in the middle of suspending, and the answer
    // cannot be written anyway — the lock has been handed back by then.
    expect(network.requests).toHaveLength(atPause())
  })

  it('coming back resumes from the positions already committed', async () => {
    const { a } = await wired()

    await a.triggers.now()
    await listeners.get('pause')!(undefined)
    listeners.get('resume')!(undefined)
    await ticks(10)
    await a.triggers.now()

    const cursors = network
      .requestsTo(SCHOOL_A)
      .filter((request) => request.path === '/sync/pull')
      .map((request) => request.body!.cursors as Record<string, number>)

    // The run after the return starts where the committed page left off rather
    // than downloading the school from the beginning.
    expect(cursors.length).toBeGreaterThan(1)
    expect(Object.values(cursors.at(-1)!).some((position) => position > 0)).toBe(true)
  })

  it('a refusal to renew strands one connection and leaves the other running', async () => {
    const { connections, a, b } = await wired()

    await a.triggers.now()

    const serverA = network.server(SCHOOL_A)
    serverA.expired = true
    serverA.refreshRefused = true

    await a.triggers.now()
    const result = await b.triggers.now()

    expect(result.outcome).toBe('completed')
    expect((await b.engine.courses.list()).map((row) => row.name)).toEqual(['Sri Isopanisad'])

    // The stranded connection keeps what it had downloaded; a token governs the
    // network, not the disk.
    expect((await a.engine.courses.list()).map((row) => row.name)).toEqual(['Bhagavad-gita'])

    const rows = await connections.list()
    expect(rows.find((row) => row.baseUrl === SCHOOL_A)!.needsSignIn).toBe(true)
    expect(rows.find((row) => row.baseUrl === SCHOOL_B)!.needsSignIn).toBe(false)
  })

  it('a run of one connection leaves the unsent rows of the other pending', async () => {
    const { db, a, b } = await wired()

    await b.engine.homework.saveAnswer(answer('written for the second school'))
    await a.engine.homework.saveAnswer(answer('written for the first school'))

    await a.triggers.now()

    const rows = await db.query<{ owner_id: string; status: string; id: number }>(
      'SELECT id, owner_id, status FROM outbox ORDER BY id ASC',
    )

    expect(rows.filter((row) => row.owner_id === 'owner-b').map((row) => row.status)).toEqual([
      'pending',
    ])
    expect(rows.filter((row) => row.owner_id === 'owner-a').map((row) => row.status)).toEqual([
      'pushed',
    ])

    // The watermark counts this connection's rows and stops at them, so the
    // other connection still has its own row to send when its turn comes.
    expect(await a.engine.state.getPushedOutboxId()).toBe(
      rows.find((row) => row.owner_id === 'owner-a')!.id,
    )

    await b.triggers.now()
    const after = await db.query<{ owner_id: string; status: string }>(
      'SELECT owner_id, status FROM outbox ORDER BY id ASC',
    )
    expect(after.filter((row) => row.owner_id === 'owner-b').map((row) => row.status)).toEqual([
      'pushed',
    ])
  })
})
