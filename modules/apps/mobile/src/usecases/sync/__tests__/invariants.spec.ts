import type {
  CourseId,
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  SchoolId,
  SectionId,
  SyncPayload,
  UserId,
} from '@vidya/domain'
import { asId, syncScopeKey } from '@vidya/domain'
import type { PullResponse } from '@vidya/protocol'
import type { ISyncClient } from '@vidya/usecases'
import { PushContractError } from '@vidya/usecases'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  FakeSyncServer,
  HOMEWORK_ID,
  LESSON_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
  serverHlc,
  STUDENT_ID,
  USER_SCOPE,
} from './fakeSyncServer'
import { type Harness, openHarness, OWNER } from './harness'

/**
 * Invariants the engine states and nothing was checking.
 *
 * Each of these was found by breaking the rule on purpose and watching the
 * whole suite stay green: the position may run backwards, an established course
 * may be reset to zero, the answer's cursor map may be thrown away. Every rule
 * below was load-bearing and held up by a comment alone, which is a rule that
 * survives exactly until the next person reads the code instead of the comment.
 *
 * Two of them need an answer no correct server composes — a grant list that
 * arrived empty, a cursor map naming a position no row reaches. Those go
 * through a thin wrapper over the fake server rather than through a second fake
 * of their own: the journal, the paging and the merge stay real, and only the
 * one field under test is staged.
 */

const homework = (fields: SyncPayload = {}): SyncPayload => ({
  id: HOMEWORK_ID,
  schoolId: SCHOOL_ID,
  enrollmentId: ENROLLMENT_ID,
  lessonVersionId: LESSON_VERSION_ID,
  sectionId: SECTION_ID,
  status: 'open',
  text: '',
  ...fields,
})

const course = (fields: SyncPayload = {}): SyncPayload => ({
  id: COURSE_ID,
  schoolId: SCHOOL_ID,
  name: 'Bhagavad-gita',
  learningType: 'group',
  ...fields,
})

const lesson = (id: string): SyncPayload => ({
  id,
  schoolId: SCHOOL_ID,
  courseId: COURSE_ID,
  title: 'Chapter one',
  lessonNumber: 1,
})

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

/** The fake server with one field of its pull answer rewritten on the way out. */
const withPullAnswer = (
  server: FakeSyncServer,
  edit: (response: PullResponse) => PullResponse,
): ISyncClient => ({
  pull: async (request) => edit(await server.pull(request)),
  push: (request) => server.push(request),
  ackCursor: (request) => server.ackCursor(request),
})

describe('invariants a mutation walked through', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
  })

  const cursorOf = async (key: string): Promise<number> => {
    const scopes = await harness.engine.state.listScopes()
    return scopes.find((scope) => syncScopeKey(scope.scope) === key)?.cursor ?? -1
  }

  it('the push watermark never runs backwards', async () => {
    await harness.engine.homework.saveAnswer(answer('one small row'))

    // A watermark raised while the request was in flight — a second run, a
    // repair, anything. The answer that comes back is about rows below it.
    harness.server.onPushApplied = async () => {
      await harness.engine.state.setPushedOutboxId(500)
    }

    await harness.engine.push()

    expect(await harness.engine.state.getPushedOutboxId()).toBe(500)
  })

  it('reporting a scope the device already follows does not rewind it', async () => {
    const state = harness.engine.state

    await state.addScope(COURSE_SCOPE)
    await state.setScopeCursor(COURSE_SCOPE, 42, 'a-summary')
    await state.addScope(COURSE_SCOPE)

    const scopes = await state.listScopes()
    const scope = scopes.find((row) => syncScopeKey(row.scope) === syncScopeKey(COURSE_SCOPE))

    // The server sends the whole grant list on every pull. A plain insert here
    // would put every established course back to the beginning on every page,
    // and the device would download its whole library again, forever.
    expect(scope!.cursor).toBe(42)
    expect(scope!.checksum).toBe('a-summary')
  })

  it('the pointer recorded for a merged document is the server stamp, not the merge', async () => {
    // The device's stamp sits above the server's, which is what a phone whose
    // clock is ahead produces — and what makes the two distinguishable here.
    harness.nowMs += 60_000
    await harness.engine.homework.saveAnswer(answer('written here, not sent yet'))

    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      hlc: serverHlc(10),
      data: homework({ status: 'reviewed' }),
    })

    await harness.engine.pull()

    // The merge kept this device's text, so the merged document carries the
    // local stamp — but what the document *descends* from is the server
    // version, and that is what the next push must declare as its `baseHlc`.
    expect(await harness.engine.apply.lastServerHlc('homework', HOMEWORK_ID)).toBe(serverHlc(10))
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('written here, not sent yet')
  })

  it('an answer carrying no grant list withdraws nothing', async () => {
    const server = new FakeSyncServer()
    let silent = false
    const client = withPullAnswer(server, (response) =>
      silent ? { ...response, scopes: [] } : response,
    )
    harness = await openHarness({ server, client })

    server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })
    server.grant(USER_SCOPE)
    await harness.engine.runner.run()

    silent = true
    const result = await harness.engine.runner.run()

    // An empty `scopes` says "nothing to report about rights". Reading it as
    // "you have been withdrawn from everything" marks every course the student
    // has gone, on a page that was only quiet (D-7, AC-22c).
    expect(result.pull?.removed).toEqual([])
    const scopes = await harness.engine.state.listScopes()
    expect(scopes.every((scope) => scope.removedAt === null)).toBe(true)
  })

  it('a position moves to what the answer says, past rows the device was not sent', async () => {
    const server = new FakeSyncServer()
    const key = syncScopeKey(COURSE_SCOPE)
    const client = withPullAnswer(server, (response) => ({
      ...response,
      cursors: { ...response.cursors, [key]: 500 },
    }))
    harness = await openHarness({ server, client })

    server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })

    await harness.engine.runner.run()

    // The rows between are this device's own, suppressed on the way out (D-5).
    // Only the answer's cursor map can carry the position over them; ignoring
    // it hands the same rows back on every pull for as long as they exist.
    expect(await cursorOf(key)).toBe(500)
    await harness.engine.runner.run()
    expect(harness.server.pullRequests.at(-1)!.cursors[key]).toBe(500)
  })

  it('a page arriving out of order leaves the position at the highest row, not the last', async () => {
    const server = new FakeSyncServer()
    const client = withPullAnswer(server, (response) => ({
      ...response,
      changes: [...response.changes].reverse(),
      cursors: {},
    }))
    harness = await openHarness({ server, client })

    server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })
    server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: COURSE_SCOPE,
      data: lesson(LESSON_ID),
    })

    await harness.engine.runner.run()

    // Taking the last row's sequence instead of the highest one leaves the
    // position below rows already applied, and every later pull delivers them
    // again (T-X-10).
    const highest = server.rows.reduce((max, row) => Math.max(max, row.serverSeq), 0)
    expect(await cursorOf(syncScopeKey(COURSE_SCOPE))).toBe(highest)
  })

  it('a push answer that does not match the batch is refused whole', async () => {
    const server = new FakeSyncServer()
    const client: ISyncClient = {
      pull: (request) => server.pull(request),
      ackCursor: (request) => server.ackCursor(request),
      push: async (request) => {
        const response = await server.push(request)
        return { ...response, results: [...response.results].reverse() }
      },
    }
    harness = await openHarness({ server, client })

    await harness.engine.homework.saveAnswer(answer('the first one'))
    await harness.engine.enrollments.request({
      id: asId<EnrollmentId>(ENROLLMENT_ID),
      schoolId: asId<SchoolId>(SCHOOL_ID),
      courseId: asId<CourseId>(COURSE_ID),
      studentId: asId<UserId>(STUDENT_ID),
    })

    const result = await harness.engine.runner.run()

    // Answers are read by position, so an answer set that does not line up
    // would mark the wrong rows pushed. Failing loudly leaves every row pending
    // and the watermark where it was, which is the state that loses nothing.
    expect(result.failure).toBeInstanceOf(PushContractError)
    const rows = await harness.outboxOf(OWNER)
    expect(rows.map((row) => row.status)).toEqual(['pending', 'pending'])
    expect(await harness.engine.state.getPushedOutboxId()).toBe(0)
  })
})
