import type { CourseId, EnrollmentId, SchoolId, SyncPayload } from '@vidya/domain'
import { asId, syncScopeKey } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  LESSON_ID,
  OTHER_COURSE_SCOPE,
  SCHOOL_ID,
  STUDENT_ID,
  USER_SCOPE,
} from './fakeSyncServer'
import { type Harness, openHarness } from './harness'

/**
 * Scope positions: T-M-12, T-M-13, T-M-14, T-M-20.
 *
 * These four are the payoff for keeping a position per scope instead of one
 * number for the journal (I-3). A new course needs no backfill path because it
 * is a scope at `0`; a suspected gap costs one course's history rather than the
 * whole database; and a withdrawal moves a flag without deleting a row.
 */

const course = (id: string, name: string): SyncPayload => ({
  id,
  schoolId: SCHOOL_ID,
  name,
  learningType: 'group',
})

const lesson = (id: string, courseId: string, title: string): SyncPayload => ({
  id,
  schoolId: SCHOOL_ID,
  courseId,
  title,
  lessonNumber: 1,
})

describe('scope positions', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(COURSE_ID, 'Bhagavad-gita'),
    })
    harness.server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: COURSE_SCOPE,
      data: lesson(LESSON_ID, COURSE_ID, 'Chapter one'),
    })
    harness.server.grant(USER_SCOPE)
    await harness.engine.runner.run()
  })

  const cursorOf = async (key: string): Promise<number> => {
    const scopes = await harness.engine.state.listScopes()
    return scopes.find((scope) => syncScopeKey(scope.scope) === key)?.cursor ?? -1
  }

  it('T-M-12: a new course is a scope at zero and arrives through an ordinary pull', async () => {
    const before = await cursorOf(syncScopeKey(COURSE_SCOPE))

    harness.server.journal({
      collection: 'courses',
      docId: OTHER_COURSE_SCOPE.id,
      scope: OTHER_COURSE_SCOPE,
      data: course(OTHER_COURSE_SCOPE.id, 'Sanskrit for beginners'),
    })

    const result = await harness.engine.runner.run()

    expect(result.pull?.added.map(syncScopeKey)).toEqual([syncScopeKey(OTHER_COURSE_SCOPE)])
    expect((await harness.engine.courses.list()).map((row) => row.name)).toContain(
      'Sanskrit for beginners',
    )

    // The established course was not disturbed on the way.
    expect(await cursorOf(syncScopeKey(COURSE_SCOPE))).toBe(before)

    // And no separate scenario was needed: this was the pull, nothing else.
    expect(harness.server.calls.filter((call) => call === 'pull').length).toBeGreaterThan(0)
  })

  it('T-M-13, T-M-20: a checksum that disagrees refetches one scope, not the database', async () => {
    const userBefore = await cursorOf(syncScopeKey(USER_SCOPE))
    harness.server.journal({
      collection: 'enrollments',
      docId: ENROLLMENT_ID,
      scope: USER_SCOPE,
      data: {
        id: ENROLLMENT_ID,
        schoolId: SCHOOL_ID,
        courseId: COURSE_ID,
        status: 'accepted',
        studentId: STUDENT_ID,
      },
    })
    await harness.engine.runner.run()
    const userSettled = await cursorOf(syncScopeKey(USER_SCOPE))
    expect(userSettled).toBeGreaterThan(userBefore)

    harness.server.forcedChecksums.set(syncScopeKey(COURSE_SCOPE), 'not-what-we-stored')
    const pullsBefore = harness.server.pullRequests.length

    const result = await harness.engine.runner.run()

    expect(result.resynced.map(syncScopeKey)).toEqual([syncScopeKey(COURSE_SCOPE)])

    // The refetch asked for that course from zero, and left the other scope
    // exactly where it stood.
    const refetch = harness.server.pullRequests.slice(pullsBefore + 1)
    expect(refetch[0]!.cursors[syncScopeKey(COURSE_SCOPE)]).toBe(0)
    expect(refetch[0]!.cursors[syncScopeKey(USER_SCOPE)]).toBe(userSettled)
    expect(await cursorOf(syncScopeKey(USER_SCOPE))).toBe(userSettled)

    // And the course's rows are back, not lost by the reset.
    expect(await harness.engine.courses.getById(asId<CourseId>(COURSE_ID))).not.toBeNull()
    expect(await harness.engine.lessons.listByCourse(asId<CourseId>(COURSE_ID))).toHaveLength(1)
  })

  it('a checksum that still agrees provokes nothing', async () => {
    const result = await harness.engine.runner.run()
    expect(result.resynced).toEqual([])
    expect(result.pull?.diverged).toEqual([])
  })

  it('T-M-14: withdrawal marks the scope gone and keeps every downloaded row', async () => {
    harness.server.journal({
      collection: 'enrollments',
      docId: ENROLLMENT_ID,
      scope: USER_SCOPE,
      data: {
        id: ENROLLMENT_ID,
        schoolId: SCHOOL_ID,
        courseId: COURSE_ID,
        status: 'accepted',
        studentId: STUDENT_ID,
      },
    })
    await harness.engine.runner.run()

    // The school withdraws the student: the scope stops being granted, and the
    // enrolment's new status travels on the student's own scope.
    harness.server.revoke(COURSE_SCOPE)
    harness.server.journal({
      collection: 'enrollments',
      docId: ENROLLMENT_ID,
      scope: USER_SCOPE,
      data: {
        id: ENROLLMENT_ID,
        schoolId: SCHOOL_ID,
        courseId: COURSE_ID,
        status: 'declined',
        studentId: STUDENT_ID,
      },
    })

    const result = await harness.engine.runner.run()

    expect(result.pull?.removed.map(syncScopeKey)).toEqual([syncScopeKey(COURSE_SCOPE)])

    const scopes = await harness.engine.state.listScopes()
    const course = scopes.find((scope) => syncScopeKey(scope.scope) === syncScopeKey(COURSE_SCOPE))
    expect(course!.removedAt).not.toBeNull()

    // Nothing was erased: the course and its lesson are still readable offline.
    expect(await harness.engine.courses.getById(asId<CourseId>(COURSE_ID))).not.toBeNull()
    expect(await harness.engine.lessons.listByCourse(asId<CourseId>(COURSE_ID))).toHaveLength(1)

    // And the screen has the status it needs to explain what happened.
    const enrollment = await harness.engine.enrollments.getById(asId<EnrollmentId>(ENROLLMENT_ID))
    expect(enrollment!.status).toBe('declined')
  })

  it('a withdrawn scope is not asked about again', async () => {
    harness.server.revoke(COURSE_SCOPE)
    // The first run is the one that learns of the withdrawal; the next one is
    // where it shows, because the position is only omitted once it is marked.
    await harness.engine.runner.run()
    await harness.engine.runner.run()

    const latest = harness.server.pullRequests.at(-1)!
    expect(latest.cursors[syncScopeKey(COURSE_SCOPE)]).toBeUndefined()
  })

  it('T-M-19: everything the device holds reads back with no network at all', async () => {
    harness.server.journal({
      collection: 'lesson_versions',
      docId: 'a41c7d02-33b5-4e8f-9c6a-71e204f5d8b3',
      scope: COURSE_SCOPE,
      data: {
        id: 'a41c7d02-33b5-4e8f-9c6a-71e204f5d8b3',
        schoolId: SCHOOL_ID,
        lessonId: LESSON_ID,
        version: 3,
        status: 'published',
        content: { schemaVersion: 1, sections: [{ id: 's1', title: 'First' }] },
      },
    })
    await harness.engine.runner.run()

    // From here on every request fails: the device is in a tunnel.
    const offline = () => {
      throw new Error('no network')
    }
    harness.server.pullFailures.push(offline, offline, offline)
    harness.server.pushFailures.push(offline, offline, offline)

    const courses = await harness.engine.courses.list()
    expect(courses).toHaveLength(1)

    const lessons = await harness.engine.lessons.listByCourse(asId<CourseId>(COURSE_ID))
    expect(lessons).toHaveLength(1)

    const version = await harness.engine.lessonVersions.getPublished(lessons[0]!.id)
    expect(version!.content.sections).toHaveLength(1)
  })
})

/** Used by the enrolment request in the offline case below. */
export const requestedEnrollment = {
  id: asId<EnrollmentId>(ENROLLMENT_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  courseId: asId<CourseId>(COURSE_ID),
}
