import type {
  BlockId,
  BlockStateId,
  CourseId,
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  SchoolId,
  SectionId,
  UserId,
} from '@vidya/domain'
import { asId, compareHlcString, parseHlc, parseIsoDateTime } from '@vidya/domain'
import { SyncTransportError } from '@vidya/usecases'
import { beforeEach, describe, expect, it } from 'vitest'

import { openTestDatabase } from '@/infra/persistence/testing'
import { HomeworkFrozenError } from '@/ports'

import {
  BLOCK_ID,
  BLOCK_STATE_ID,
  COURSE_ID,
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
  STUDENT_ID,
  USER_SCOPE,
} from './fakeSyncServer'
import { failingDatabase, type Harness, openHarness, OTHER_OWNER, OWNER } from './harness'

/**
 * The journal decorator.
 *
 * Everything runs against real SQLite. The atomicity case in particular cannot
 * be shown any other way — a fake repository has no transaction to roll back,
 * so a test over one would pass whether or not the decorator opened one.
 */

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

const SUBMITTED_AT = parseIsoDateTime('2026-09-18T10:00:00.000Z')

describe('the journal decorator', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
  })

  it('writing homework offline creates an outbox row', async () => {
    const saved = await harness.engine.homework.saveAnswer(answer('written on the train'))

    const rows = await harness.outboxOf(OWNER)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      collection: 'homework',
      docId: HOMEWORK_ID,
      op: 'upsert',
      status: 'pending',
      ownerId: OWNER,
    })
    expect(rows[0]!.data).toMatchObject({ text: 'written on the train' })
    expect(saved.text).toBe('written on the train')

    // Nothing left the device: the write never touched the transport.
    expect(harness.server.pushRequests).toHaveLength(0)
  })

  it('writing with an expired token still creates an outbox row', async () => {
    harness.server.pushFailures.push(() => {
      throw new SyncTransportError('unauthorized')
    })
    harness.server.pullFailures.push(() => {
      throw new SyncTransportError('unauthorized')
    })

    await harness.engine.homework.saveAnswer(answer('offline, token expired'))
    const result = await harness.engine.runner.run()

    expect(result.outcome).toBe('deferred')
    expect(await harness.outboxOf(OWNER)).toHaveLength(1)
    expect((await harness.outboxOf(OWNER))[0]!.status).toBe('pending')
  })

  it('the domain row and the outbox row are one transaction', async () => {
    const database = await openTestDatabase()
    const broken = await openHarness({
      db: failingDatabase(database.db, (sql) => sql.includes('INSERT INTO outbox')),
    })

    await expect(broken.engine.homework.saveAnswer(answer('never lands'))).rejects.toThrow(
      /staged failure/,
    )

    expect(await broken.count('homework')).toBe(0)
    expect(await broken.count('outbox')).toBe(0)
  })

  it('an answer already handed in is refused locally', async () => {
    await harness.engine.homework.saveAnswer(answer('first draft'))
    await harness.engine.homework.submit(asId<HomeworkId>(HOMEWORK_ID), SUBMITTED_AT)

    await expect(harness.engine.homework.saveAnswer(answer('second thoughts'))).rejects.toThrow(
      HomeworkFrozenError,
    )

    // The refusal left nothing behind: two writes, two rows, not three.
    const rows = await harness.outboxOf(OWNER)
    expect(rows).toHaveLength(2)
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('first draft')
  })

  it('an answer returned for revision is editable again', async () => {
    await harness.engine.homework.saveAnswer(answer('first draft'))
    await harness.db.execute("UPDATE homework SET status = 'returned' WHERE id = ?", [HOMEWORK_ID])

    await expect(harness.engine.homework.saveAnswer(answer('revised'))).resolves.toMatchObject({
      text: 'revised',
    })
  })

  it('stamps each write with a strictly increasing HLC', async () => {
    await harness.engine.homework.saveAnswer(answer('one'))
    await harness.engine.blockStates.save({
      id: asId<BlockStateId>(BLOCK_STATE_ID),
      schoolId: asId<SchoolId>(SCHOOL_ID),
      enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
      lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
      blockId: asId<BlockId>(BLOCK_ID),
      state: { watched: 12 },
    })

    const rows = await harness.outboxOf(OWNER)
    expect(compareHlcString(rows[1]!.hlc, rows[0]!.hlc)).toBeGreaterThan(0)
    expect(parseHlc(rows[0]!.hlc).deviceId).toBe('device-a')
  })

  it('carries the clock forward from what the pull observed, not only what we wrote', async () => {
    // A stamp from a device whose clock runs ahead of ours.
    const ahead = `${String(harness.nowMs + 60_000).padStart(15, '0')}:00000:device-b`
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      hlc: ahead,
      data: {
        id: HOMEWORK_ID,
        schoolId: SCHOOL_ID,
        enrollmentId: ENROLLMENT_ID,
        lessonVersionId: LESSON_VERSION_ID,
        sectionId: SECTION_ID,
        status: 'open',
        text: 'from the other phone',
      },
    })

    await harness.engine.runner.run()
    await harness.engine.homework.saveAnswer(answer('written here, later'))

    const rows = await harness.outboxOf(OWNER)
    expect(compareHlcString(rows[0]!.hlc, ahead)).toBeGreaterThan(0)
  })

  it('a second identity does not journal under the first, and cannot push its rows', async () => {
    await harness.engine.homework.saveAnswer(answer('written by the first student'))

    const second = await openHarness({
      db: harness.db,
      ownerId: OTHER_OWNER,
      server: harness.server,
    })
    await second.engine.enrollments.request({
      id: asId<EnrollmentId>(ENROLLMENT_ID),
      schoolId: asId<SchoolId>(SCHOOL_ID),
      courseId: asId<CourseId>(COURSE_ID),
      studentId: asId<UserId>(STUDENT_ID),
    })

    expect(await harness.outboxOf(OWNER)).toHaveLength(1)
    expect(await harness.outboxOf(OTHER_OWNER)).toHaveLength(1)

    await second.engine.runner.run()

    const sent = second.server.pushRequests.flatMap((request) => request.changes)
    expect(sent.map((change) => change.collection)).toEqual(['enrollments'])
  })

  it('no path removes an outbox row', async () => {
    await harness.engine.homework.saveAnswer(answer('kept forever'))
    const before = (await harness.allOutboxRows()).length

    await harness.engine.runner.run()
    await harness.engine.runner.run()

    expect((await harness.allOutboxRows()).length).toBeGreaterThanOrEqual(before)
  })
})
