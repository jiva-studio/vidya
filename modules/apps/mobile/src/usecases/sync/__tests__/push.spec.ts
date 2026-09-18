import type {
  CourseId,
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  SchoolId,
  SectionId,
  UserId,
} from '@vidya/domain'
import { asId } from '@vidya/domain'
import { journalHasLocalWrites } from '@vidya/usecases'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
  STUDENT_ID,
} from './fakeSyncServer'
import { type Harness, openHarness, OTHER_OWNER, OWNER } from './harness'

/**
 * Draining the journal:.
 *
 * The invariant under every one of them is the same, and it is the reason this
 * lane exists: **the student's work never leaves the device because of a
 * synchronisation decision.** An accepted row is marked, a refused row keeps
 * its reason, and the table only ever grows.
 */

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

describe('pushing the journal', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
  })

  it('an accepted row moves the watermark and is never sent twice', async () => {
    await harness.engine.homework.saveAnswer(answer('please mark this'))

    const first = await harness.engine.runner.run()
    expect(first.push?.accepted).toBe(1)

    const rows = await harness.outboxOf(OWNER)
    expect(rows[0]!.status).toBe('pushed')
    expect(await harness.engine.state.getPushedOutboxId()).toBe(rows[0]!.id)

    const before = harness.server.pushRequests.length
    await harness.engine.runner.run()

    expect(harness.server.pushRequests.length).toBe(before)
  })

  it('a refused row keeps its reason, and the watermark steps past it', async () => {
    harness.server.rejectIf = (change) =>
      change.collection === 'homework' ? 'alreadyAccepted' : null

    await harness.engine.homework.saveAnswer(answer('written after it was marked'))
    const result = await harness.engine.runner.run()

    expect(result.push?.rejected).toBe(1)

    const rows = await harness.outboxOf(OWNER)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: 'rejected', reason: 'alreadyAccepted' })

    // The work itself is still on the phone, which is the point of the refusal
    // being a state rather than an error.
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('written after it was marked')

    const sent = harness.server.pushRequests.length
    await harness.engine.runner.run()
    expect(harness.server.pushRequests.length).toBe(sent)
  })

  it('a refusal leaves its neighbours applied', async () => {
    harness.server.rejectIf = (change) =>
      change.collection === 'enrollments' ? 'notYourEnrollment' : null

    await harness.engine.enrollments.request({
      id: asId<EnrollmentId>(ENROLLMENT_ID),
      schoolId: asId<SchoolId>(SCHOOL_ID),
      courseId: asId<CourseId>(COURSE_ID),
      studentId: asId<UserId>(STUDENT_ID),
    })
    await harness.engine.homework.saveAnswer(answer('unrelated, and fine'))

    const result = await harness.engine.runner.run()

    expect(result.push).toMatchObject({ accepted: 1, rejected: 1 })
    const rows = await harness.outboxOf(OWNER)
    expect(rows.map((row) => row.status)).toEqual(['rejected', 'pushed'])
  })

  it('a full cycle never shrinks the outbox', async () => {
    harness.server.rejectIf = (change) => (change.outboxId === 2 ? 'malformed' : null)

    await harness.engine.homework.saveAnswer(answer('one'))
    await harness.engine.enrollments.request({
      id: asId<EnrollmentId>(ENROLLMENT_ID),
      schoolId: asId<SchoolId>(SCHOOL_ID),
      courseId: asId<CourseId>(COURSE_ID),
      studentId: asId<UserId>(STUDENT_ID),
    })

    const counts: number[] = [(await harness.allOutboxRows()).length]
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await harness.engine.runner.run()
      counts.push((await harness.allOutboxRows()).length)
    }

    expect(counts).toEqual([...counts].sort((left, right) => left - right))
    expect(counts[0]).toBe(2)
  })

  it('a run gives ours up before it takes theirs', async () => {
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: { id: COURSE_ID, schoolId: SCHOOL_ID, name: 'Gita', learningType: 'group' },
    })
    await harness.engine.homework.saveAnswer(answer('mine first'))

    await harness.engine.runner.run()

    expect(harness.server.calls.indexOf('push')).toBeLessThan(harness.server.calls.indexOf('pull'))
  })

  it('the journal checkpoint refuses a state without the answer just written', async () => {
    await harness.engine.homework.saveAnswer(answer('just typed'))
    const result = await harness.engine.runner.run()

    const latest = await harness.engine.outbox.latestId(OWNER)
    expect(journalHasLocalWrites(result.push!.journaledOutboxId, latest)).toBe(true)

    // A second answer typed after the run is not in the journal yet, so the
    // checkpoint says the interface may not paint the server's state.
    await harness.engine.homework.saveAnswer(answer('typed after the run'))
    const afterwards = await harness.engine.outbox.latestId(OWNER)

    expect(journalHasLocalWrites(result.push!.journaledOutboxId, afterwards)).toBe(false)
  })

  it('a second run rides the first instead of draining twice', async () => {
    await harness.engine.homework.saveAnswer(answer('sent once'))

    const [first, second] = await Promise.all([
      harness.engine.runner.run(),
      harness.engine.runner.run(),
    ])

    expect(first.outcome).toBe('completed')
    expect(second.outcome).toBe('alreadyRunning')
    expect(harness.server.pushRequests).toHaveLength(1)
    expect(harness.server.pushRequests[0]!.changes).toHaveLength(1)
  })

  it('the watermark is kept per identity', async () => {
    await harness.engine.homework.saveAnswer(answer('first student'))
    await harness.engine.runner.run()
    const firstWatermark = await harness.engine.state.getPushedOutboxId()
    expect(firstWatermark).toBeGreaterThan(0)

    const second = await openHarness({
      db: harness.db,
      ownerId: OTHER_OWNER,
      server: harness.server,
    })

    expect(await second.engine.state.getPushedOutboxId()).toBe(0)

    await second.engine.enrollments.request({
      id: asId<EnrollmentId>(ENROLLMENT_ID),
      schoolId: asId<SchoolId>(SCHOOL_ID),
      courseId: asId<CourseId>(COURSE_ID),
      studentId: asId<UserId>(STUDENT_ID),
    })
    await second.engine.runner.run()

    // Each identity's watermark moved over its own rows only.
    expect(await harness.engine.state.getPushedOutboxId()).toBe(firstWatermark)
    expect(await second.engine.state.getPushedOutboxId()).toBeGreaterThan(firstWatermark)
  })

  it('sends two edits of one document in the order they were made', async () => {
    await harness.engine.homework.saveAnswer(answer('first thought'))
    harness.nowMs += 1_000
    await harness.engine.homework.saveAnswer(answer('second thought'))

    await harness.engine.runner.run()

    const sent = harness.server.pushRequests[0]!.changes
    expect(sent.map((change) => change.outboxId)).toEqual([1, 2])
    expect(sent.map((change) => (change.data as { text: string }).text)).toEqual([
      'first thought',
      'second thought',
    ])
  })
})
