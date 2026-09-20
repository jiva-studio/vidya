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
import { asId, parseHlc, syncScopeKey } from '@vidya/domain'
import { SYNC_CLOCK_SKEW_TOLERANCE_MS } from '@vidya/protocol'
import { describe, expect, it } from 'vitest'

import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  FakeSyncServer,
  HOMEWORK_ID,
  LESSON_ID,
  LESSON_VERSION_ID,
  OTHER_COURSE_SCOPE,
  SCHOOL_ID,
  SECTION_ID,
  STUDENT_ID,
  USER_SCOPE,
} from './fakeSyncServer'
import { type Harness, openHarness, OWNER } from './harness'

/**
 * Two things happening at once.
 *
 * Two devices of one student are the only place in this design where last write
 * wins at all — everywhere else the writing sides are split and there is
 * nothing to race over. So these tests are mostly about that pair, plus the
 * couple of races inside one device: a write during a push, and two runs.
 */

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

const lesson = (id: string, courseId: string): SyncPayload => ({
  id,
  schoolId: SCHOOL_ID,
  courseId,
  title: `Lesson ${id.slice(-2)}`,
  lessonNumber: 1,
})

/** Two phones of one student, against one server. */
async function twoDevices(): Promise<{ one: Harness; two: Harness; server: FakeSyncServer }> {
  const server = new FakeSyncServer()
  server.scopeFor = () => USER_SCOPE
  const one = await openHarness({ server, deviceId: 'device-one' })
  const two = await openHarness({ server, deviceId: 'device-two' })

  return { one, two, server }
}

const textOf = async (harness: Harness): Promise<unknown> =>
  (await harness.row('homework', HOMEWORK_ID))!.text

describe('two devices of one student', () => {
  it('both phones pick the same winner', async () => {
    const { one, two } = await twoDevices()

    one.nowMs = 1_789_689_600_000
    two.nowMs = 1_789_689_700_000

    await one.engine.homework.saveAnswer(answer('from the phone'))
    await two.engine.homework.saveAnswer(answer('from the tablet'))

    await one.engine.runner.run()
    await two.engine.runner.run()
    await one.engine.runner.run()
    await two.engine.runner.run()

    // The later stamp wins, and it wins identically on both.
    expect(await textOf(one)).toBe('from the tablet')
    expect(await textOf(two)).toBe('from the tablet')
  })

  it('a phone whose clock is a year fast is restamped, and does not drag the others into the future', async () => {
    const { one, two, server } = await twoDevices()

    one.nowMs = server.serverNowMs
    two.nowMs = server.serverNowMs + 365 * 24 * 60 * 60 * 1000

    await one.engine.homework.saveAnswer(answer('written today'))
    await two.engine.homework.saveAnswer(answer('written in a year'))

    await two.engine.runner.run()
    await one.engine.runner.run()
    await two.engine.runner.run()

    // Both agree, and neither is anchored a year out: the server pulled the
    // stamp back to its own clock rather than refusing the work.
    expect(await textOf(one)).toBe(await textOf(two))

    const pointer = await one.engine.apply.latestServerHlc()
    expect(parseHlc(pointer!).physical).toBeLessThanOrEqual(
      server.serverNowMs + SYNC_CLOCK_SKEW_TOLERANCE_MS,
    )

    const restamped = server.pushRequests
      .flatMap((request) => request.changes)
      .filter((change) => parseHlc(change.hlc).deviceId === 'device-two')
    expect(restamped).not.toHaveLength(0)
  })

  it('the two phones keep independent read positions', async () => {
    const { one, two, server } = await twoDevices()
    server.pageSize = 1

    server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: COURSE_SCOPE,
      data: lesson(LESSON_ID, COURSE_ID),
    })
    server.journal({
      collection: 'lessons',
      docId: secondLesson,
      scope: COURSE_SCOPE,
      data: lesson(secondLesson, COURSE_ID),
    })

    await one.engine.runner.run()
    expect(await one.count('lessons')).toBe(2)

    // The second phone has read nothing yet, and its position says so.
    const positions = await two.engine.state.listScopes()
    expect(positions).toEqual([])

    await two.engine.runner.run()
    expect(await two.count('lessons')).toBe(2)

    const onePosition = await positionOf(one, syncScopeKey(COURSE_SCOPE))
    const twoPosition = await positionOf(two, syncScopeKey(COURSE_SCOPE))
    expect(onePosition).toBe(twoPosition)
    expect(onePosition).toBeGreaterThan(0)
  })

  /**
   * The same row put away on one handset and brought back on the other.
   *
   * `archivedByStudentAt` is the student's own field on both devices, so the
   * two writes meet with nothing to arbitrate them but their stamps. The later
   * one stands, and it stands on both — there is no rule here beyond that.
   */
  it('both phones take the later word on whether a row was put away', async () => {
    const { one, two, server } = await twoDevices()

    server.journal({
      collection: 'enrollments',
      docId: ENROLLMENT_ID,
      scope: USER_SCOPE,
      data: {
        id: ENROLLMENT_ID,
        schoolId: SCHOOL_ID,
        courseId: COURSE_ID,
        studentId: STUDENT_ID,
        groupId: null,
        status: 'declined',
        decidedById: null,
        decidedAt: '2026-01-05T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        preferredGroupId: null,
        preferredTimes: null,
        comment: null,
        archivedByStudentAt: '2026-01-06T00:00:00.000Z',
      },
    })

    await one.engine.runner.run()
    await two.engine.runner.run()

    const place = asId<EnrollmentId>(ENROLLMENT_ID)

    one.nowMs = 1_789_689_600_000
    two.nowMs = 1_789_689_700_000

    await one.engine.enrollments.unarchive(place)
    await two.engine.enrollments.archive(place)

    await one.engine.runner.run()
    await two.engine.runner.run()
    await one.engine.runner.run()
    await two.engine.runner.run()

    const later = new Date(two.nowMs).toISOString()

    expect((await one.engine.enrollments.getById(place))!.archivedByStudentAt).toBe(later)
    expect((await two.engine.enrollments.getById(place))!.archivedByStudentAt).toBe(later)
    expect(await one.engine.enrollments.list()).toEqual([])
  })
})

describe('races inside one device', () => {
  it('an edit made during a push is not lost', async () => {
    const harness = await openHarness()
    await harness.engine.homework.saveAnswer(answer('first'))

    // The student types again while the batch is in flight.
    harness.server.onPushApplied = async () => {
      harness.server.onPushApplied = null
      harness.nowMs += 1_000
      await harness.engine.homework.saveAnswer(answer('second, typed mid-flight'))
    }

    await harness.engine.runner.run()

    // The round that was in flight answered for the first row only. The second
    // is still pending — not lost, and not mistakenly marked sent by a
    // watermark that jumped over it.
    const rows = await harness.outboxOf(OWNER)
    expect(rows.map((row) => row.status)).toEqual(['pushed', 'pending'])
    expect(await harness.engine.state.getPushedOutboxId()).toBe(rows[0]!.id)
    expect(await textOf(harness)).toBe('second, typed mid-flight')

    await harness.engine.runner.run()
    expect((await harness.outboxOf(OWNER)).map((row) => row.status)).toEqual(['pushed', 'pushed'])
  })

  it('an identical page does not rewrite the row under an open screen', async () => {
    const harness = await openHarness()
    const payload = {
      id: LESSON_VERSION_ID,
      schoolId: SCHOOL_ID,
      lessonId: LESSON_ID,
      version: 3,
      status: 'published',
      content: { schemaVersion: 1, sections: [] },
    }
    harness.server.journal({
      collection: 'lesson_versions',
      docId: LESSON_VERSION_ID,
      scope: COURSE_SCOPE,
      data: payload,
    })
    await harness.engine.runner.run()

    // The engine can say "this changes nothing" without writing, which is what
    // keeps a reconnect from repainting the lesson the student is reading.
    expect(
      await harness.engine.apply.hasSamePayload('lesson_versions', LESSON_VERSION_ID, payload),
    ).toBe(true)
    expect(
      await harness.engine.apply.hasSamePayload('lesson_versions', LESSON_VERSION_ID, {
        ...payload,
        version: 4,
      }),
    ).toBe(false)
  })

  it('the server applied and the answer was lost — the repeat converges', async () => {
    const harness = await openHarness()
    await harness.engine.homework.saveAnswer(answer('applied once'))

    harness.server.onPushApplied = () => {
      harness.server.onPushApplied = null
      throw new Error('the answer never arrived')
    }

    await harness.engine.runner.run()
    await harness.engine.runner.run()

    expect(harness.server.rows.filter((row) => row.docId === HOMEWORK_ID)).toHaveLength(1)
    expect(await textOf(harness)).toBe('applied once')
    expect((await harness.outboxOf(OWNER))[0]!.status).toBe('pushed')
  })

  it('enrolling on one course while another is being fetched disturbs neither', async () => {
    const harness = await openHarness()
    harness.server.pageSize = 1
    for (let index = 0; index < 3; index += 1) {
      harness.server.journal({
        collection: 'lessons',
        docId: pagedLesson(index),
        scope: COURSE_SCOPE,
        data: lesson(pagedLesson(index), COURSE_ID),
      })
    }

    // Halfway through the first course's history the student asks to join a second.
    harness.server.onPull = async (index) => {
      if (index !== 1) return
      harness.server.onPull = null
      await harness.engine.enrollments.request({
        id: asId<EnrollmentId>(ENROLLMENT_ID),
        schoolId: asId<SchoolId>(SCHOOL_ID),
        courseId: asId<CourseId>(OTHER_COURSE_SCOPE.id),
        studentId: asId<UserId>(STUDENT_ID),
      })
    }

    await harness.engine.runner.run()

    expect(await harness.count('lessons')).toBe(3)
    expect(await harness.outboxOf(OWNER)).toHaveLength(1)

    await harness.engine.runner.run()
    expect((await harness.outboxOf(OWNER))[0]!.status).toBe('pushed')
  })

  it('two runs at once are one run', async () => {
    const harness = await openHarness()
    harness.server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: COURSE_SCOPE,
      data: lesson(LESSON_ID, COURSE_ID),
    })
    await harness.engine.homework.saveAnswer(answer('sent once, not twice'))

    const results = await Promise.all([harness.engine.runner.run(), harness.engine.runner.run()])

    expect(results[1]!.outcome).toBe('alreadyRunning')
    expect(harness.server.pushRequests).toHaveLength(1)
    expect(harness.server.rows.filter((row) => row.docId === HOMEWORK_ID)).toHaveLength(1)
    expect(harness.engine.runner.isRunning()).toBe(false)
  })
})

const positionOf = async (harness: Harness, key: string): Promise<number> => {
  const scopes = await harness.engine.state.listScopes()
  return scopes.find((scope) => syncScopeKey(scope.scope) === key)?.cursor ?? 0
}

const secondLesson = 'c92b48e1-0f77-4d35-a8b2-6e1d3c05f483'
const pagedLesson = (index: number): string =>
  `c92b48e1-0f77-4d35-a8b2-6e1d3c05f4${String(90 + index).padStart(2, '0')}`
