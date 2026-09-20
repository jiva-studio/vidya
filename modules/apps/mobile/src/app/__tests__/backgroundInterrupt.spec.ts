import { asId } from '@vidya/domain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IDatabase } from '@/ports'
import { DatabaseSuspendedError } from '@/ports'
import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  SCHOOL_ID,
  USER_SCOPE,
} from '@/usecases/sync/__tests__/fakeSyncServer'

import { connectionTo, inMemoryConnectionStore } from './connectionFixtures'
import { fakeSyncNetwork, ticks } from './fakeSyncNetwork'

/**
 * What going into the background costs, measured in the order things happen.
 *
 * The lock has to come back before the queue drains — a run still waiting its
 * turn must be dropped rather than started behind the one in flight — while the
 * page that has already been downloaded is still allowed to commit. Both halves
 * are invisible from the app: the price of getting them wrong is an app iOS
 * kills on a student's handset, or a page downloaded twice.
 */

const listeners = new Map<string, (event: unknown) => void>()

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, handler: (payload: unknown) => void) => {
      listeners.set(event, handler)
      return Promise.resolve({ remove: () => Promise.resolve() })
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

const SCHOOL_A = 'https://school-a.test'
const SCHOOL_B = 'https://school-b.test'

const network = fakeSyncNetwork()

/** Polls until the database refuses a transaction, or gives up. */
async function lockReleased(db: IDatabase): Promise<boolean> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      await db.transaction(async () => undefined)
    } catch (error) {
      return error instanceof DatabaseSuspendedError
    }
    await ticks(1)
  }

  return false
}

describe('the background interrupts the queue', () => {
  beforeEach(() => {
    listeners.clear()
    network.install()
  })

  afterEach(() => {
    network.restore()
  })

  /** Two schools over one database, the first with a page to hand out. */
  const wired = async () => {
    const { db } = await openTestDatabase()

    const serverA = network.add(SCHOOL_A, 'owner-a')
    const serverB = network.add(SCHOOL_B, 'owner-b')

    serverA.sync.pageSize = 1
    serverA.sync.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: { id: COURSE_ID, schoolId: SCHOOL_ID, name: 'Bhagavad-gita', learningType: 'group' },
    })
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

    const one = connectionTo(SCHOOL_A, serverA)
    const two = connectionTo(SCHOOL_B, serverB)
    const connections = inMemoryConnectionStore([one, two])

    const a = await startSync({ db, connection: one, connections })
    const b = await startSync({ db, connection: two, connections })

    // The handset is put away while the first page is still on the wire.
    serverA.sync.onPull = async () => {
      serverA.sync.onPull = null
      await listeners.get('pause')!(undefined)
    }

    return { db, a, b }
  }

  it('gives the lock back before the queue drains, and commits the page in hand', async () => {
    const { db, a, b } = await wired()

    let drained = false
    const runs = Promise.all([a.triggers.now(), b.triggers.now()]).then(() => {
      drained = true
    })

    expect(await lockReleased(db)).toBe(true)
    expect(drained).toBe(false)

    await runs

    // The page already downloaded reached its commit; the run that had not
    // started never went near the network.
    expect(await a.engine.courses.getById(asId(COURSE_ID))).not.toBeNull()
    expect(network.requestsTo(SCHOOL_B)).toHaveLength(0)
  })

  it('a return that lands while the page is committing leaves the database working', async () => {
    const { db, a } = await wired()
    const serverA = network.server(SCHOOL_A)

    // Put away and picked straight back up — the task switcher. The return
    // arrives while the page in flight is still on its way to a commit, and
    // the suspension waiting behind it must not take the lock away afterwards:
    // nothing would be left to give it back, and sync would be dead until the
    // app was restarted, with nothing on screen to say so.
    serverA.sync.onPull = async () => {
      serverA.sync.onPull = null
      void listeners.get('pause')!(undefined)
      listeners.get('resume')!(undefined)
    }

    await a.triggers.now()
    await ticks(50)

    await expect(db.transaction(async () => undefined)).resolves.toBeUndefined()
    expect((await a.triggers.now()).outcome).toBe('completed')
  })

  it('drops the run it interrupted rather than resurrecting it on the way back', async () => {
    const { db, a, b } = await wired()

    const runs = Promise.all([a.triggers.now(), b.triggers.now()])
    expect(await lockReleased(db)).toBe(true)

    // Back within the second, before the queue has had its turn. The waiting
    // run is not what should answer for the return: the foreground asks for a
    // fresh one, and two runs of the same connection would push the same rows.
    listeners.get('resume')!(undefined)

    const [, second] = await runs
    expect(second.outcome).toBe('paused')
  })
})
