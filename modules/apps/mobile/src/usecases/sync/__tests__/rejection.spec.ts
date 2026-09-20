import type {
  CourseId,
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  OutboxEntry,
  SchoolId,
  SectionId,
  SyncPayload,
  UserId,
} from '@vidya/domain'
import { asId } from '@vidya/domain'
import type { PullRequest, PushRequest } from '@vidya/protocol'
import type { ISyncClient } from '@vidya/usecases'
import { SyncTransportError } from '@vidya/usecases'
import { beforeEach, describe, expect, it } from 'vitest'

import type { FakeSyncServer } from './fakeSyncServer'
import {
  COURSE_ID,
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
  STUDENT_ID,
  USER_SCOPE,
} from './fakeSyncServer'
import { deadRows, type Harness, openHarness, OWNER } from './harness'

/**
 * A refusal is the end of the road for the row that carried it.
 *
 * Today a refused row is answered once and then never sent again — the
 * watermark stepped over it — yet it goes on counting as unsettled work, so the
 * document it names stays in `pendingDocs` and the merge keeps laying the local
 * value over every page the server sends, for good. One refusal and the
 * document on this handset diverges from the school's copy permanently; no
 * retry and no sign-in repairs it.
 *
 * What follows states the settled end instead: the row leaves the unsettled
 * list, the document takes the server's version again, and the refused work is
 * still shown to the student rather than quietly painted as accepted.
 */

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

const application = () => ({
  id: asId<EnrollmentId>(ENROLLMENT_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  courseId: asId<CourseId>(COURSE_ID),
  studentId: asId<UserId>(STUDENT_ID),
})

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

const unsettledRows = (harness: Harness): Promise<readonly OutboxEntry[]> =>
  harness.engine.outbox.listUnsettled({ ownerId: OWNER })

/** A transport that applies part of a batch and then loses the answer, once. */
function transportLosingTheAnswer(server: FakeSyncServer, applied: number): ISyncClient {
  let armed = true

  return {
    pull: (request: PullRequest) => server.pull(request),
    ackCursor: (request) => server.ackCursor(request),
    push: async (request: PushRequest) => {
      if (!armed) return server.push(request)

      armed = false
      await server.push({ ...request, changes: request.changes.slice(0, applied) })
      throw new SyncTransportError('unreachable', 'the answer never came back')
    },
  }
}

describe('a refusal that ends the row', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
  })

  it('a refused row leaves the unsettled list', async () => {
    harness.server.rejectIf = (change) => (change.collection === 'homework' ? 'malformed' : null)

    await harness.engine.homework.saveAnswer(answer('refused once'))
    await harness.engine.runner.run()

    expect((await harness.outboxOf(OWNER))[0]).toMatchObject({
      status: 'rejected',
      reason: 'malformed',
    })
    expect(await unsettledRows(harness)).toEqual([])
  })

  it('the document a refused row named takes the version the school holds', async () => {
    harness.server.rejectIf = (change) => (change.collection === 'homework' ? 'malformed' : null)

    await harness.engine.homework.saveAnswer(answer('typed on the phone'))
    await harness.engine.runner.run()

    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ status: 'accepted', text: 'the copy the school holds' }),
    })
    await harness.engine.runner.run()

    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('the copy the school holds')

    // And it keeps taking them: a refusal pins the document once, not forever.
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ status: 'accepted', text: 'marked a second time' }),
    })
    await harness.engine.runner.run()

    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('marked a second time')
  })

  it('a refusal on one row of a batch does not settle or strand its neighbours', async () => {
    harness.server.rejectIf = (change) =>
      change.collection === 'enrollments' ? 'notYourEnrollment' : null

    await harness.engine.enrollments.request(application())
    await harness.engine.homework.saveAnswer(answer('unrelated, and fine'))
    await harness.engine.runner.run()

    expect((await harness.outboxOf(OWNER)).map((row) => row.status)).toEqual(['rejected', 'pushed'])

    // Neither row is unsettled any more — one was taken, one is finished — and
    // only the refused one is dead.
    expect(await unsettledRows(harness)).toEqual([])
    expect((await deadRows(harness)).map((row) => row.collection)).toEqual(['enrollments'])

    // The neighbour reached the journal and is not dragged back by its company.
    expect(harness.server.rows.filter((row) => row.collection === 'homework')).toHaveLength(1)
  })

  it('refused work is still shown, and is never reported as accepted', async () => {
    harness.server.rejectIf = (change) =>
      change.collection === 'enrollments' ? 'notYourEnrollment' : null

    await harness.engine.enrollments.request(application())
    await harness.engine.runner.run()

    const dead = await deadRows(harness)

    expect(dead).toHaveLength(1)
    expect(dead[0]).toMatchObject({
      collection: 'enrollments',
      docId: ENROLLMENT_ID,
      status: 'rejected',
      reason: 'notYourEnrollment',
    })
  })

  it('the stamp does not fall back when a row becomes rejected', async () => {
    harness.server.rejectIf = (change) => (change.collection === 'homework' ? 'malformed' : null)

    await harness.engine.homework.saveAnswer(answer('first try'))
    await harness.engine.runner.run()

    const refused = (await harness.outboxOf(OWNER))[0]!
    expect(refused.status).toBe('rejected')

    // The same millisecond, so only the counter can keep the order.
    harness.server.rejectIf = () => null
    await harness.engine.homework.saveAnswer(answer('second try'))

    const rows = await harness.outboxOf(OWNER)
    expect(rows).toHaveLength(2)
    expect(rows[1]!.hlc > refused.hlc).toBe(true)
    expect(new Set(rows.map((row) => row.hlc)).size).toBe(2)

    // And the server takes it as work of its own rather than swallowing it as a
    // repeat of a stamp it has already seen.
    await harness.engine.runner.run()

    expect(rows[1]!.id).toBeGreaterThan(refused.id)
    expect((await harness.outboxOf(OWNER))[1]!.status).toBe('pushed')
    const journaled = harness.server.rows.filter((row) => row.collection === 'homework')
    expect(journaled).toHaveLength(1)
    expect(journaled[0]!.data!.text).toBe('second try')
  })

  it('a batch applied in part with its answer lost repeats without duplicating', async () => {
    const device = await openHarness({
      server: harness.server,
      client: transportLosingTheAnswer(harness.server, 1),
    })

    await device.engine.enrollments.request(application())
    await device.engine.homework.saveAnswer(answer('the second of two'))

    const first = await device.engine.runner.run()

    expect(first.outcome).toBe('retryLater')
    expect((await device.outboxOf(OWNER)).map((row) => row.status)).toEqual(['pending', 'pending'])
    expect(await device.engine.state.getPushedOutboxId()).toBe(0)

    const second = await device.engine.runner.run()

    expect(second.outcome).toBe('completed')
    expect((await device.outboxOf(OWNER)).map((row) => row.status)).toEqual(['pushed', 'pushed'])
    expect(harness.server.rows.filter((row) => row.collection === 'enrollments')).toHaveLength(1)
    expect(harness.server.rows.filter((row) => row.collection === 'homework')).toHaveLength(1)
  })

  it('the same batch sent twice lands once and answers the same way', async () => {
    await harness.engine.homework.saveAnswer(answer('sent once'))
    await harness.engine.runner.run()

    const sent = harness.server.pushRequests[0]!
    const firstAnswer = harness.server.pushRequests.length
    const journaled = harness.server.rows.length
    const outbox = await harness.outboxOf(OWNER)

    const replay = await harness.server.push(sent)

    expect(harness.server.pushRequests.length).toBe(firstAnswer + 1)
    expect(harness.server.rows).toHaveLength(journaled)
    expect(replay.results.map((result) => result.status)).toEqual(['accepted'])
    expect(await harness.outboxOf(OWNER)).toEqual(outbox)
  })
})
