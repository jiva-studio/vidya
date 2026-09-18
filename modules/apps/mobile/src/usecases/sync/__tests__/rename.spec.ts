import type {
  BlockId,
  CourseId,
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  SchoolId,
  SectionId,
  UserId,
} from '@vidya/domain'
import { asId } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import { openTestDatabase } from '@/infra/persistence/testing'

import {
  BLOCK_ID,
  BLOCK_STATE_ID,
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
  STUDENT_ID,
  USER_SCOPE,
} from './fakeSyncServer'
import { failingDatabase, type Harness, openHarness, OWNER } from './harness'

/**
 * One section, two devices, two names for it.
 *
 * A device names the work it writes offline, so the phone and the tablet of one
 * student hand in the same section under two ids. The server's tables are keyed
 * naturally — enrolment, version, section — so the second push lands on the row
 * the first created, and the answer carries `serverDocId`: your row and mine are
 * the same row, and this is its name.
 *
 * Everything below is about what the device owes that sentence. Ignore it and
 * the loser keeps a local row the server has never heard of, which no pull
 * carries and no tombstone removes, beside the winner as a second answer to one
 * section.
 */

/** The id the first device gave the section, and the server kept. */
const SERVER_ID = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'

/** The id this device gave the same section, offline. */
const LOCAL_ID = 'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb'

const answerKey = {
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
}

const answer = (id: string, text: string) => ({
  ...answerKey,
  id: asId<HomeworkId>(id),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  text,
})

/** The stamp the other device wrote under — below anything this one issues. */
const EARLIER_HLC = '001789689500000:00000:device-phone'

/** The row the other device handed in, as the server's journal holds it. */
const serverAnswer = {
  id: SERVER_ID,
  schoolId: SCHOOL_ID,
  enrollmentId: ENROLLMENT_ID,
  lessonVersionId: LESSON_VERSION_ID,
  sectionId: SECTION_ID,
  status: 'pending',
  text: 'written on the phone',
  createdAt: '2026-09-18T07:00:00.000Z',
}

describe('adopting the id the server wrote under', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
    harness.server.journal({
      collection: 'homework',
      docId: SERVER_ID,
      scope: COURSE_SCOPE,
      data: serverAnswer,
      hlc: EARLIER_HLC,
      deviceId: 'device-phone',
    })
  })

  it('leaves one answer to the section, under the server name', async () => {
    await harness.engine.homework.saveAnswer(answer(LOCAL_ID, 'written on the tablet'))

    await harness.engine.push()

    expect(await harness.row('homework', LOCAL_ID)).toBeNull()
    expect(await harness.row('homework', SERVER_ID)).toMatchObject({
      text: 'written on the tablet',
    })
    expect(await harness.count('homework')).toBe(1)
    expect(await harness.engine.homework.getByAnswerKey(answerKey)).toMatchObject({
      id: SERVER_ID,
    })
  })

  it('drops the local row when the winner is already here from a pull', async () => {
    await harness.engine.homework.saveAnswer(answer(LOCAL_ID, 'written on the tablet'))
    await harness.engine.pull()

    await harness.engine.push()

    expect(await harness.row('homework', LOCAL_ID)).toBeNull()
    expect(await harness.row('homework', SERVER_ID)).not.toBeNull()
    expect(await harness.count('homework')).toBe(1)
  })

  it('sends the edit that was still waiting under the local name', async () => {
    await harness.engine.homework.saveAnswer(answer(LOCAL_ID, 'written on the tablet'))

    // The student keeps typing while the first push is in flight, so the edit is
    // journaled under the local name and is not in the batch being answered.
    harness.server.onPushApplied = async () => {
      harness.server.onPushApplied = null
      harness.nowMs += 1000
      await harness.engine.homework.saveAnswer(answer(LOCAL_ID, 'and a second thought'))
    }

    await harness.engine.push()

    const waiting = await harness.engine.outbox.listPending({ ownerId: OWNER })
    expect(waiting.map((entry) => entry.docId)).toEqual([SERVER_ID])

    await harness.engine.push()

    expect(harness.server.pushRequests.at(-1)?.changes[0]?.docId).toBe(SERVER_ID)
    expect(await harness.row('homework', SERVER_ID)).toMatchObject({
      text: 'and a second thought',
    })
  })

  it('keeps a later pull from putting the older text back', async () => {
    await harness.engine.homework.saveAnswer(answer(LOCAL_ID, 'written on the tablet'))
    await harness.engine.push()

    expect(await harness.engine.apply.lastServerHlc('homework', LOCAL_ID)).toBeNull()
    expect(await harness.engine.apply.lastServerHlc('homework', SERVER_ID)).not.toBeNull()

    // The row the other device handed in, delivered after ours was accepted: an
    // older version of the same document, which the pointer has to refuse.
    await harness.engine.pull()

    expect(await harness.row('homework', SERVER_ID)).toMatchObject({
      text: 'written on the tablet',
    })
  })

  it('costs nothing when the push is repeated', async () => {
    await harness.engine.homework.saveAnswer(answer(LOCAL_ID, 'written on the tablet'))

    // The server applied the row and the answer never arrived.
    harness.server.onPushApplied = () => {
      harness.server.onPushApplied = null
      throw new Error('the connection dropped after the row was written')
    }
    await expect(harness.engine.push()).rejects.toThrow(/connection dropped/)

    await harness.engine.push()
    await harness.engine.push()

    expect(await harness.row('homework', LOCAL_ID)).toBeNull()
    expect(await harness.count('homework')).toBe(1)
    expect(await harness.engine.outbox.listPending({ ownerId: OWNER })).toHaveLength(0)
  })

  it('writes no half of the rename when the transaction fails', async () => {
    const { db } = await openTestDatabase()
    const guarded = failingDatabase(db, (sql) => sql.includes('UPDATE outbox SET doc_id'))
    harness = await openHarness({ db: guarded })
    harness.server.journal({
      collection: 'homework',
      docId: SERVER_ID,
      scope: COURSE_SCOPE,
      data: serverAnswer,
      hlc: EARLIER_HLC,
      deviceId: 'device-phone',
    })
    await harness.engine.homework.saveAnswer(answer(LOCAL_ID, 'written on the tablet'))

    await expect(harness.engine.push()).rejects.toThrow(/staged failure/)

    expect(await harness.row('homework', LOCAL_ID)).not.toBeNull()
    expect(await harness.row('homework', SERVER_ID)).toBeNull()

    const waiting = await harness.engine.outbox.listPending({ ownerId: OWNER })
    expect(waiting.map((entry) => entry.docId)).toEqual([LOCAL_ID])
    expect(await harness.engine.state.getPushedOutboxId()).toBe(0)
  })
})

describe('adopting the id of a renamed place on a course', () => {
  /** The id the school's own record of the enrolment carries. */
  const SERVER_ENROLLMENT = 'cccccccc-3333-4ccc-8ccc-cccccccccccc'

  /** The id this device gave the same request, offline. */
  const LOCAL_ENROLLMENT = 'dddddddd-4444-4ddd-8ddd-dddddddddddd'

  const openWithServerEnrollment = async (): Promise<Harness> => {
    const harness = await openHarness()
    harness.server.journal({
      collection: 'enrollments',
      docId: SERVER_ENROLLMENT,
      scope: USER_SCOPE,
      data: {
        id: SERVER_ENROLLMENT,
        schoolId: SCHOOL_ID,
        courseId: COURSE_ID,
        studentId: STUDENT_ID,
        status: 'active',
        createdAt: '2026-09-18T06:00:00.000Z',
      },
      deviceId: 'device-phone',
    })

    return harness
  }

  const requestLocally = async (harness: Harness): Promise<void> => {
    await harness.engine.enrollments.request({
      id: asId<EnrollmentId>(LOCAL_ENROLLMENT),
      schoolId: asId<SchoolId>(SCHOOL_ID),
      courseId: asId<CourseId>(COURSE_ID),
      studentId: asId<UserId>(STUDENT_ID),
    })
    await harness.engine.homework.saveAnswer({
      ...answer(LOCAL_ID, 'written on the tablet'),
      enrollmentId: asId<EnrollmentId>(LOCAL_ENROLLMENT),
    })
    await harness.engine.blockStates.save({
      id: BLOCK_STATE_ID,
      schoolId: asId<SchoolId>(SCHOOL_ID),
      enrollmentId: asId<EnrollmentId>(LOCAL_ENROLLMENT),
      lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
      blockId: asId<BlockId>(BLOCK_ID),
      state: { watched: 12 },
    })
  }

  /** The place on the course, the answers and the progress that hang off it. */
  const placeAfterPush = async (harness: Harness) => ({
    local: await harness.row('enrollments', LOCAL_ENROLLMENT),
    server: await harness.row('enrollments', SERVER_ENROLLMENT),
    homework: await harness.engine.homework.listByEnrollment(asId<EnrollmentId>(SERVER_ENROLLMENT)),
    states: await harness.engine.blockStates.listByLessonVersion(
      asId<EnrollmentId>(SERVER_ENROLLMENT),
      asId<LessonVersionId>(LESSON_VERSION_ID),
    ),
  })

  it('takes the homework and the block states with it', async () => {
    const harness = await openWithServerEnrollment()
    await requestLocally(harness)

    await harness.engine.push()

    const place = await placeAfterPush(harness)
    expect(place.local).toBeNull()
    expect(place.server).not.toBeNull()
    expect(place.homework).toHaveLength(1)
    expect(place.states).toHaveLength(1)
  })

  it('drops the local request when the school record is already here', async () => {
    const harness = await openWithServerEnrollment()
    await requestLocally(harness)

    // Nothing locally refuses two names for one place, so the pull leaves both
    // rows standing and the push's answer is what settles which one is real.
    await harness.engine.pull()
    expect(await harness.count('enrollments')).toBe(2)

    await harness.engine.push()

    const place = await placeAfterPush(harness)
    expect(place.local).toBeNull()
    expect(place.server).not.toBeNull()
    expect(await harness.count('enrollments')).toBe(1)
    expect(place.homework).toHaveLength(1)
    expect(place.states).toHaveLength(1)
  })
})
