import type {
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  SchoolId,
  SectionId,
  SyncPayload,
} from '@vidya/domain'
import { asId, syncScopeKey } from '@vidya/domain'
import { SyncTransportError } from '@vidya/usecases'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openTestDatabase } from '@/infra/persistence/testing'

import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_ID,
  OTHER_COURSE_SCOPE,
  SCHOOL_ID,
  SECTION_ID,
} from './fakeSyncServer'
import { failingDatabase, type Harness, openHarness, OWNER } from './harness'

/**
 * Dropped connections.
 *
 * One break at exactly one point, then the run again. The claim is always the
 * same: **a repeat is safe**.
 * Nothing is duplicated, nothing is skipped, and the student's work is where
 * they left it.
 */

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

const LESSON_VERSION_ID = 'a41c7d02-33b5-4e8f-9c6a-71e204f5d8b3'

const lesson = (id: string, title: string): SyncPayload => ({
  id,
  schoolId: SCHOOL_ID,
  courseId: COURSE_ID,
  title,
  lessonNumber: 1,
})

const drop = () => {
  throw new SyncTransportError('unreachable', 'the connection dropped')
}

describe('a connection that drops', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
  })

  it('dropped before the push leaves everything as it was', async () => {
    await harness.engine.homework.saveAnswer(answer('written offline'))
    harness.server.pushFailures.push(drop)

    const result = await harness.engine.runner.run()

    expect(result.outcome).toBe('retryLater')
    expect((await harness.outboxOf(OWNER))[0]!.status).toBe('pending')
    expect(await harness.engine.state.getPushedOutboxId()).toBe(0)
    expect(harness.server.rows).toHaveLength(0)
  })

  it('dropped after the push landed — the repeat is free, no duplicate', async () => {
    await harness.engine.homework.saveAnswer(answer('sent, answer lost'))

    // The server applied the batch; the answer never came back.
    harness.server.onPushApplied = () => {
      harness.server.onPushApplied = null
      drop()
    }

    const first = await harness.engine.runner.run()
    expect(first.outcome).toBe('retryLater')
    expect((await harness.outboxOf(OWNER))[0]!.status).toBe('pending')

    const second = await harness.engine.runner.run()
    expect(second.outcome).toBe('completed')

    // Two requests, one journal row: the idempotency key did its job.
    expect(harness.server.pushRequests).toHaveLength(2)
    expect(harness.server.rows.filter((row) => row.docId === HOMEWORK_ID)).toHaveLength(1)
    expect((await harness.outboxOf(OWNER))[0]!.status).toBe('pushed')
  })

  it('dropped mid-page leaves the position where it was', async () => {
    harness.server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: COURSE_SCOPE,
      data: lesson(LESSON_ID, 'Chapter one'),
    })
    harness.server.pullFailures.push(drop)

    const result = await harness.engine.runner.run()

    expect(result.outcome).toBe('retryLater')
    expect(await harness.count('lessons')).toBe(0)
    expect(await harness.engine.state.listScopes()).toEqual([])
  })

  it('a crash between the rows and the position rolls both back, and the repeat is clean', async () => {
    const database = await openTestDatabase()
    let broken = true
    const flaky = failingDatabase(database.db, (sql) => broken && sql.includes('INTO sync_scopes'))
    const device = await openHarness({ db: flaky, server: harness.server })

    harness.server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: COURSE_SCOPE,
      data: lesson(LESSON_ID, 'Chapter one'),
    })

    await device.engine.runner.run()
    expect(await device.count('lessons')).toBe(0)

    broken = false
    await device.engine.runner.run()

    expect(await device.count('lessons')).toBe(1)
    expect(await device.count('sync_scopes')).toBeGreaterThan(0)
  })

  it('a break in a new scope leaves only that scope behind', async () => {
    harness.server.pageSize = 1
    harness.server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: COURSE_SCOPE,
      data: lesson(LESSON_ID, 'Chapter one'),
    })
    await harness.engine.runner.run()
    const settled = await cursorOf(harness, syncScopeKey(COURSE_SCOPE))

    // A second course arrives with a history of its own, and the connection
    // dies partway through it.
    for (let index = 0; index < 3; index += 1) {
      harness.server.journal({
        collection: 'lessons',
        docId: otherLessonId(index),
        scope: OTHER_COURSE_SCOPE,
        data: { ...lesson(otherLessonId(index), `New ${index}`), courseId: OTHER_COURSE_SCOPE.id },
      })
    }
    harness.server.pullFailures.push(() => undefined as never, drop)

    await harness.engine.runner.run()

    const partial = await cursorOf(harness, syncScopeKey(OTHER_COURSE_SCOPE))
    expect(partial).toBeGreaterThan(0)
    expect(await cursorOf(harness, syncScopeKey(COURSE_SCOPE))).toBe(settled)

    harness.server.pageSize = 50
    await harness.engine.runner.run()

    expect(await harness.count('lessons')).toBe(4)
    expect(await cursorOf(harness, syncScopeKey(COURSE_SCOPE))).toBe(settled)
  })

  it('a failed acknowledgement keeps the merge and repeats the ack', async () => {
    harness.server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: COURSE_SCOPE,
      data: lesson(LESSON_ID, 'Chapter one'),
    })
    harness.server.ackFailures.push(drop)

    const first = await harness.engine.runner.run()

    expect(first.outcome).toBe('completed')
    expect(first.pull?.ackFailed).toBe(true)
    expect(await harness.count('lessons')).toBe(1)
    expect(await harness.engine.state.getAckedSeq()).toBe(0)

    const second = await harness.engine.runner.run()

    expect(second.pull?.ackFailed).toBe(false)
    expect(await harness.engine.state.getAckedSeq()).toBeGreaterThan(0)
    expect(harness.server.ackRequests).toHaveLength(2)
  })

  it('three triggers in a row give one run, not three', async () => {
    await harness.engine.homework.saveAnswer(answer('flapping network'))

    const outcomes = await Promise.all([
      harness.engine.runner.run(),
      harness.engine.runner.run(),
      harness.engine.runner.run(),
    ])

    expect(outcomes.map((result) => result.outcome)).toEqual([
      'completed',
      'alreadyRunning',
      'alreadyRunning',
    ])
    expect(harness.server.pushRequests).toHaveLength(1)
  })

  it('a timeout behaves exactly like a dropped connection', async () => {
    await harness.engine.homework.saveAnswer(answer('timed out'))
    harness.server.pushFailures.push(() => {
      throw new SyncTransportError('unreachable', 'timed out after 30s')
    })

    const result = await harness.engine.runner.run()

    expect(result.outcome).toBe('retryLater')
    expect(result.retryAfterMs).toBeGreaterThan(0)
    expect((await harness.outboxOf(OWNER))[0]!.status).toBe('pending')
  })

  it('a 500 stops the run without touching anything', async () => {
    await harness.engine.homework.saveAnswer(answer('server is unwell'))
    const before = await harness.outboxOf(OWNER)
    harness.server.pushFailures.push(() => {
      throw new SyncTransportError('server', 'internal server error')
    })

    const result = await harness.engine.runner.run()

    expect(result.outcome).toBe('retryLater')
    expect(await harness.outboxOf(OWNER)).toEqual(before)
    expect(await harness.engine.state.getPushedOutboxId()).toBe(0)
  })

  it('a 429 leads to a wait, not a retry loop', async () => {
    await harness.engine.homework.saveAnswer(answer('too fast'))
    harness.server.pushFailures.push(() => {
      throw new SyncTransportError('rateLimited', 'slow down', 30_000)
    })

    const result = await harness.engine.runner.run()

    expect(result.outcome).toBe('retryLater')
    expect(result.retryAfterMs).toBe(30_000)
    // One attempt, and no second one behind it.
    expect(harness.server.pushRequests).toHaveLength(1)
  })
})

describe('an expired token', () => {
  it('refreshing fails, the run is deferred, and nothing else is disturbed', async () => {
    const refreshToken = vi.fn(async () => false)
    const harness = await openHarness({ refreshToken })

    harness.server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: COURSE_SCOPE,
      data: lesson(LESSON_ID, 'Chapter one'),
    })
    await harness.engine.runner.run()

    await harness.engine.homework.saveAnswer(answer('written while signed out'))
    harness.server.pushFailures.push(() => {
      throw new SyncTransportError('unauthorized', 'token expired')
    })

    const result = await harness.engine.runner.run()

    expect(result.outcome).toBe('deferred')
    expect(refreshToken).toHaveBeenCalledTimes(1)

    // The outbox is untouched and offline reading still works: the session was
    // never ended.
    expect((await harness.outboxOf(OWNER))[0]!.status).toBe('pending')
    expect(await harness.engine.lessons.listByCourse(asId<never>(COURSE_ID))).toHaveLength(1)
  })

  it('refreshing succeeds and the run is retried exactly once', async () => {
    const refreshToken = vi.fn(async () => true)
    const harness = await openHarness({ refreshToken })

    await harness.engine.homework.saveAnswer(answer('written on a stale token'))
    harness.server.pushFailures.push(() => {
      throw new SyncTransportError('unauthorized', 'token expired')
    })

    const result = await harness.engine.runner.run()

    expect(result.outcome).toBe('completed')
    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect((await harness.outboxOf(OWNER))[0]!.status).toBe('pushed')
  })

  it('a second refusal after a successful refresh defers instead of looping', async () => {
    const refreshToken = vi.fn(async () => true)
    const harness = await openHarness({ refreshToken })

    await harness.engine.homework.saveAnswer(answer('nothing will help'))
    const refuse = () => {
      throw new SyncTransportError('unauthorized', 'token expired')
    }
    harness.server.pushFailures.push(refuse, refuse, refuse)

    const result = await harness.engine.runner.run()

    expect(result.outcome).toBe('deferred')
    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(harness.server.pushRequests).toHaveLength(2)
  })
})

const cursorOf = async (harness: Harness, key: string): Promise<number> => {
  const scopes = await harness.engine.state.listScopes()
  return scopes.find((scope) => syncScopeKey(scope.scope) === key)?.cursor ?? 0
}

const otherLessonId = (index: number): string =>
  `b6d40e27-8c31-4a95-b7f2-0e5a1d38c6${String(30 + index).padStart(2, '0')}`

export { ENROLLMENT_ID, SECTION_ID }
