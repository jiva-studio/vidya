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
import { asId } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
  STUDENT_ID,
  USER_SCOPE,
} from './fakeSyncServer'
import { type Harness, openHarness, OTHER_OWNER, OWNER } from './harness'

/**
 * Two students on one handset:.
 *
 * There is one database per installation, not one per account. That is a
 * deliberate choice and it buys something worth having — signing out erases
 * nothing, so signing back in is instant and works with no network at all. The
 * price is that every read, every position and every pointer has to be filtered
 * by owner, and these tests are what keeps that price paid.
 */

const course = (name: string): SyncPayload => ({
  id: COURSE_ID,
  schoolId: SCHOOL_ID,
  name,
  learningType: 'group',
})

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

describe('two identities on one installation', () => {
  let first: Harness
  let second: Harness

  beforeEach(async () => {
    first = await openHarness()
    first.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course('Bhagavad-gita'),
    })
    first.server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: COURSE_SCOPE,
      data: { id: LESSON_ID, schoolId: SCHOOL_ID, courseId: COURSE_ID, title: 'One' },
    })
    first.server.grant(USER_SCOPE)
    await first.engine.runner.run()
    await first.engine.homework.saveAnswer(answer('the first student wrote this'))

    second = await openHarness({
      db: first.db,
      ownerId: OTHER_OWNER,
      server: first.server,
    })
  })

  it('the second identity sees none of the first', async () => {
    expect(await second.engine.courses.list()).toEqual([])
    expect(await second.engine.lessons.listByCourse(asId<CourseId>(COURSE_ID))).toEqual([])
    expect(await second.engine.homework.getById(asId<HomeworkId>(HOMEWORK_ID))).toBeNull()
    expect(await second.engine.state.listScopes()).toEqual([])
    expect(await second.engine.apply.latestServerHlc()).toBeNull()

    // The rows are on the disk; they are simply not this identity's.
    expect(await first.count('courses')).toBe(1)
  })

  it('coming back to the first identity offline shows everything, unsent rows included', async () => {
    // The second identity does a run of its own, which must not disturb the first.
    await second.engine.enrollments.request({
      id: asId<EnrollmentId>(ENROLLMENT_ID),
      schoolId: asId<SchoolId>(SCHOOL_ID),
      courseId: asId<CourseId>(COURSE_ID),
      studentId: asId<UserId>(STUDENT_ID),
    })
    await second.engine.runner.run()

    // Back to the first student, with no network whatsoever.
    const back = await openHarness({ db: first.db, ownerId: OWNER, server: first.server })
    const offline = () => {
      throw new Error('no network')
    }
    back.server.pullFailures.push(offline, offline)
    back.server.pushFailures.push(offline, offline)

    expect((await back.engine.courses.list()).map((row) => row.name)).toEqual(['Bhagavad-gita'])
    expect(await back.engine.lessons.listByCourse(asId<CourseId>(COURSE_ID))).toHaveLength(1)

    const own = await back.outboxOf(OWNER)
    expect(own).toHaveLength(1)
    expect(own[0]!.status).toBe('pending')
    expect(own[0]!.data).toMatchObject({ text: 'the first student wrote this' })

    // And the scope positions it had are still its own.
    expect(await back.engine.state.listScopes()).not.toEqual([])
  })

  it('a pull under the second identity does not write into the first identity rows', async () => {
    first.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course('Renamed after the handover'),
    })

    await second.engine.runner.run()

    expect((await first.engine.courses.getById(asId<CourseId>(COURSE_ID)))!.name).toBe(
      'Bhagavad-gita',
    )
    expect((await second.engine.courses.getById(asId<CourseId>(COURSE_ID)))!.name).toBe(
      'Renamed after the handover',
    )
  })

  it('the HLC pointers are kept per identity', async () => {
    await second.engine.runner.run()

    const firstPointer = await first.engine.apply.lastServerHlc('courses', COURSE_ID)
    const secondPointer = await second.engine.apply.lastServerHlc('courses', COURSE_ID)

    expect(firstPointer).not.toBeNull()
    expect(secondPointer).not.toBeNull()

    const rows = await first.db.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM sync_doc_hlc WHERE collection = ? AND doc_id = ?',
      ['courses', COURSE_ID],
    )
    expect(Number(rows[0]!.total)).toBe(2)
  })
})
