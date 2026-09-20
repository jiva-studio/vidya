import type {
  CourseId,
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  SchoolId,
  SectionId,
  SyncPayload,
  SyncScopeRef,
} from '@vidya/domain'
import { asId, isSyncRejectionReason, SyncCollections, syncScopeKey } from '@vidya/domain'
import type { ISyncClient } from '@vidya/usecases'
import { beforeEach, describe, expect, it } from 'vitest'

import { openTestDatabase } from '@/infra/persistence/testing'
import { COLLECTION_PROJECTIONS } from '@/infra/repositories'
import type { IDatabase } from '@/ports'

import {
  BLOCK_ID,
  BLOCK_STATE_ID,
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  type FakeSyncServer,
  HOMEWORK_ID,
  LESSON_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
  STUDENT_ID,
  USER_SCOPE,
} from './fakeSyncServer'
import { failingDatabase, type Harness, openHarness, OWNER } from './harness'

/**
 * AC-P43h — a role that was taken away takes its rows with it.
 *
 * Today a revoked scope stops being pulled and nothing else happens: the rows
 * it brought stay on the device for good, readable offline by someone the
 * school has already removed. These state the other half — the scope leaves and
 * its data leaves with it, the withdrawal reaches the device even when it was
 * the last role held, the grant coming back brings the rows back, and unsent
 * work inside a departing scope is settled by a named rule rather than left
 * queued against rights nobody holds.
 *
 * The scope of a row is the server's, not a column here: `journal/projections.ts`
 * addresses `schools`, `courses` and `groups` to the school, `lessons` and
 * `lesson_versions` to the course, and `enrollments`, `homework` and
 * `block_states` to the student's own scope. Every expectation below follows
 * that map, which is why a course going does *not* take the student's own
 * enrolment: that row travels on the user scope and outlives the course.
 */

const SCHOOL_SCOPE: SyncScopeRef = { kind: 'school', id: SCHOOL_ID }
const GROUP_ID = 'f2a9c471-3e58-4b06-9d12-7c4e5a0b3f81'

/** A grant of a kind this build does not know — what a newer server may send. */
const UNREADABLE_GRANT = { kind: 'group', id: GROUP_ID }

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

/** Every row the school hands a member of it, on the scope the server uses. */
function seed(server: FakeSyncServer): void {
  server.journal({
    collection: 'schools',
    docId: SCHOOL_ID,
    scope: SCHOOL_SCOPE,
    data: { id: SCHOOL_ID, schoolId: SCHOOL_ID, name: 'Gita school' },
  })
  server.journal({
    collection: 'courses',
    docId: COURSE_ID,
    scope: SCHOOL_SCOPE,
    data: { id: COURSE_ID, schoolId: SCHOOL_ID, name: 'Bhagavad-gita', learningType: 'group' },
  })
  server.journal({
    collection: 'groups',
    docId: GROUP_ID,
    scope: SCHOOL_SCOPE,
    data: {
      id: GROUP_ID,
      schoolId: SCHOOL_ID,
      courseId: COURSE_ID,
      name: 'Morning group',
      status: 'active',
    },
  })
  server.journal({
    collection: 'lessons',
    docId: LESSON_ID,
    scope: COURSE_SCOPE,
    data: {
      id: LESSON_ID,
      schoolId: SCHOOL_ID,
      courseId: COURSE_ID,
      title: 'One',
      lessonNumber: 1,
    },
  })
  server.journal({
    collection: 'lesson_versions',
    docId: LESSON_VERSION_ID,
    scope: COURSE_SCOPE,
    data: {
      id: LESSON_VERSION_ID,
      schoolId: SCHOOL_ID,
      lessonId: LESSON_ID,
      version: 1,
      status: 'published',
      content: { schemaVersion: 1, sections: [{ id: SECTION_ID, title: 'First' }] },
    },
  })
  server.journal({
    collection: 'enrollments',
    docId: ENROLLMENT_ID,
    scope: USER_SCOPE,
    data: {
      id: ENROLLMENT_ID,
      schoolId: SCHOOL_ID,
      courseId: COURSE_ID,
      studentId: STUDENT_ID,
      status: 'accepted',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  })
  server.journal({
    collection: 'homework',
    docId: HOMEWORK_ID,
    scope: USER_SCOPE,
    data: {
      id: HOMEWORK_ID,
      schoolId: SCHOOL_ID,
      enrollmentId: ENROLLMENT_ID,
      lessonVersionId: LESSON_VERSION_ID,
      sectionId: SECTION_ID,
      status: 'open',
      text: 'the answer the school already has',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  })
  server.journal({
    collection: 'block_states',
    docId: BLOCK_STATE_ID,
    scope: USER_SCOPE,
    data: {
      id: BLOCK_STATE_ID,
      schoolId: SCHOOL_ID,
      enrollmentId: ENROLLMENT_ID,
      lessonVersionId: LESSON_VERSION_ID,
      blockId: BLOCK_ID,
      state: { watched: true },
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  })
}

/** Counts a table by name, quoted — `groups` is a keyword in newer SQLite. */
async function countOf(db: IDatabase, table: string): Promise<number> {
  const rows = await db.query<{ total: number }>(`SELECT COUNT(*) AS total FROM "${table}"`)
  return Number(rows[0]?.total ?? 0)
}

const scopeStateOf = async (harness: Harness, scope: SyncScopeRef) => {
  const scopes = await harness.engine.state.listScopes()
  return scopes.find((state) => syncScopeKey(state.scope) === syncScopeKey(scope))
}

/** Every table a scope of some kind writes to, as the device stores them. */
const TABLES = [
  'schools',
  'courses',
  'groups',
  'lessons',
  'lesson_versions',
  'enrollments',
  'homework',
  'block_states',
] as const

const census = async (db: IDatabase): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {}
  for (const table of TABLES) counts[table] = await countOf(db, table)
  return counts
}

describe('AC-P43h — a revoked scope takes its rows off the device', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
    seed(harness.server)
    await harness.engine.runner.run()

    // Nothing is proved by a purge of a table that was empty to begin with.
    expect(await census(harness.db)).toEqual({
      schools: 1,
      courses: 1,
      groups: 1,
      lessons: 1,
      lesson_versions: 1,
      enrollments: 1,
      homework: 1,
      block_states: 1,
    })
  })

  it('the school going takes the school, its catalogue and its groups', async () => {
    harness.server.revoke(SCHOOL_SCOPE)

    const result = await harness.engine.runner.run()
    expect(result.pull?.removed.map(syncScopeKey)).toEqual([syncScopeKey(SCHOOL_SCOPE)])

    const counts = await census(harness.db)
    expect({
      schools: counts.schools,
      courses: counts.courses,
      groups: counts.groups,
    }).toEqual({ schools: 0, courses: 0, groups: 0 })

    // The scopes still granted are untouched: a school leaving is not a wipe.
    expect({
      lessons: counts.lessons,
      enrollments: counts.enrollments,
      homework: counts.homework,
    }).toEqual({ lessons: 1, enrollments: 1, homework: 1 })
  })

  it('the course going takes its lessons and published versions', async () => {
    harness.server.revoke(COURSE_SCOPE)

    const result = await harness.engine.runner.run()
    expect(result.pull?.removed.map(syncScopeKey)).toEqual([syncScopeKey(COURSE_SCOPE)])

    const counts = await census(harness.db)
    expect({ lessons: counts.lessons, lesson_versions: counts.lesson_versions }).toEqual({
      lessons: 0,
      lesson_versions: 0,
    })

    // The enrolment names this course and is not this course's to take: it
    // travels on the student's own scope and has to stay, with its status, or
    // the screen has nothing left to explain the withdrawal with.
    expect(counts.enrollments).toBe(1)
    expect(counts.courses).toBe(1)
    expect(
      await harness.engine.enrollments.getById(asId<EnrollmentId>(ENROLLMENT_ID)),
    ).not.toBeNull()
  })

  it('the user scope going takes the enrolment and the work written under it', async () => {
    harness.server.revoke(USER_SCOPE)

    const result = await harness.engine.runner.run()
    expect(result.pull?.removed.map(syncScopeKey)).toEqual([syncScopeKey(USER_SCOPE)])

    const counts = await census(harness.db)
    expect({
      enrollments: counts.enrollments,
      homework: counts.homework,
      block_states: counts.block_states,
    }).toEqual({ enrollments: 0, homework: 0, block_states: 0 })

    // Course material is somebody else's grant and stays.
    expect({ lessons: counts.lessons, schools: counts.schools }).toEqual({
      lessons: 1,
      schools: 1,
    })
  })

  it('the last role going — an answer that grants nothing — is a withdrawal too', async () => {
    // Exactly what the wire sends a member who has just been removed from the
    // only school they belonged to: `scopes` present and empty. Read as
    // "nothing to report", this reaches the device never.
    for (const scope of [SCHOOL_SCOPE, COURSE_SCOPE, USER_SCOPE]) harness.server.revoke(scope)

    const result = await harness.engine.runner.run()

    expect(result.pull?.removed.map(syncScopeKey).sort()).toEqual(
      [SCHOOL_SCOPE, COURSE_SCOPE, USER_SCOPE].map(syncScopeKey).sort(),
    )

    const counts = await census(harness.db)
    expect(Object.values(counts)).toEqual(TABLES.map(() => 0))

    for (const scope of [SCHOOL_SCOPE, COURSE_SCOPE, USER_SCOPE]) {
      expect((await scopeStateOf(harness, scope))?.removedAt).not.toBeNull()
    }
  })

  it('a grant of a kind this build cannot read does not hide the withdrawal beside it', async () => {
    // A newer server grants a kind this build has never heard of. It is dropped
    // on the way in — and dropping it must not turn the rest of the list into
    // "nothing to report", or one unknown kind buries every later revocation.
    harness.server.revoke(USER_SCOPE)

    const withUnknownGrant: ISyncClient = {
      push: (request) => harness.server.push(request),
      ackCursor: (request) => harness.server.ackCursor(request),
      pull: async (request) => {
        const response = await harness.server.pull(request)
        return {
          ...response,
          scopes: [{ scope: UNREADABLE_GRANT as SyncScopeRef, headSeq: 0 }, ...response.scopes],
        }
      },
    }

    const staged = await openHarness({ db: harness.db, client: withUnknownGrant })
    await staged.engine.runner.run()

    const counts = await census(harness.db)
    expect(counts.enrollments).toBe(0)
    expect(counts.homework).toBe(0)

    // And the readable grants that came back in the same list kept their rows.
    expect({ schools: counts.schools, lessons: counts.lessons }).toEqual({
      schools: 1,
      lessons: 1,
    })
  })
})

describe('AC-P43h — the grant comes back', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
    seed(harness.server)
    await harness.engine.runner.run()
  })

  it('leaves the withdrawn scope standing at zero with no checksum', async () => {
    harness.server.revoke(COURSE_SCOPE)
    await harness.engine.runner.run()

    // The position describes rows that are no longer here. Left where it stood,
    // it is a promise the device cannot keep: a re-grant would ask only for
    // what happened while it was away and the deleted history would never come.
    const state = await scopeStateOf(harness, COURSE_SCOPE)
    expect(state?.removedAt).not.toBeNull()
    expect({ cursor: state?.cursor, checksum: state?.checksum }).toEqual({
      cursor: 0,
      checksum: null,
    })
  })

  it('brings every row of the scope back', async () => {
    harness.server.revoke(COURSE_SCOPE)
    await harness.engine.runner.run()
    expect(await countOf(harness.db, 'lessons')).toBe(0)

    harness.server.grant(COURSE_SCOPE)
    await harness.engine.runner.run()

    expect(await countOf(harness.db, 'lessons')).toBe(1)
    expect(await countOf(harness.db, 'lesson_versions')).toBe(1)

    // The content, not just the row: a version refused as stale because the
    // per-document server pointer outlived the purge is a lesson that reads
    // back empty for good.
    const lessons = await harness.engine.lessons.listByCourse(asId<CourseId>(COURSE_ID))
    expect(lessons).toHaveLength(1)
    const version = await harness.engine.lessonVersions.getPublished(lessons[0]!.id)
    expect(version!.content.sections).toHaveLength(1)
  })

  it('erases and resets in one transaction, or does neither', async () => {
    // The purge failing halfway is the one state that must not exist: rows gone
    // with the position still ahead of them, and no later pull that would ever
    // ask for them again.
    // The mark is the last word of a withdrawal, so refusing it is the way to
    // ask whether the erasing before it was part of the same commit.
    let failing = false
    const base = (await openTestDatabase()).db
    const db = failingDatabase(
      base,
      (sql) => failing && /update/i.test(sql) && /removed_at/i.test(sql),
    )

    const staged = await openHarness({ db })
    seed(staged.server)
    await staged.engine.runner.run()
    const before = await scopeStateOf(staged, COURSE_SCOPE)

    staged.server.revoke(COURSE_SCOPE)
    failing = true
    await expect(staged.engine.pull()).rejects.toThrow(/staged failure/)

    // Nothing moved: not the rows, not the mark, not the position.
    expect(await countOf(db, 'lessons')).toBe(1)
    expect(await countOf(db, 'lesson_versions')).toBe(1)
    const after = await scopeStateOf(staged, COURSE_SCOPE)
    expect(after?.removedAt ?? null).toBeNull()
    expect(after?.cursor).toBe(before?.cursor)

    // And the attempt that is allowed to finish does the whole of it, so the
    // state above is the one a rollback produced rather than the one a
    // withdrawal that erases nothing produces anyway.
    failing = false
    await staged.engine.pull()
    expect(await countOf(db, 'lessons')).toBe(0)
    expect(await countOf(db, 'lesson_versions')).toBe(0)
    const settled = await scopeStateOf(staged, COURSE_SCOPE)
    expect(settled?.removedAt).not.toBeNull()
    expect(settled?.cursor).toBe(0)
  })
})

/**
 * Unsent work inside a scope that is going.
 *
 * The rule: the row is **settled as dead work** — marked
 * `rejected` with `scopeRevoked`, kept in the table, and read back through
 * `listDead`. It is never sent, because the rights that would have carried it
 * are gone; it is never deleted, because the outbox deletes nothing and the
 * student is still owed the sight of what they wrote; and it leaves
 * `listUnsettled`, because a row that stays there lays its text over every page
 * the server sends for as long as the document exists.
 */
describe('AC-P43h — unsent work inside a departing scope', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
    seed(harness.server)
    await harness.engine.runner.run()

    await harness.engine.homework.saveAnswer(answer('written just before the removal'))
    expect((await harness.outboxOf(OWNER))[0]!.status).toBe('pending')
  })

  it('is settled as dead work rather than left queued', async () => {
    harness.server.revoke(USER_SCOPE)

    // The pull half on its own: pull-to-refresh with the queue still full is
    // exactly how a device learns it has been removed before it has sent.
    await harness.engine.pull()

    const rows = await harness.outboxOf(OWNER)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.status).toBe('rejected')

    // A role taken away is not a request that was turned down, and the two say
    // different things on the screen. `enrollmentRevoked` is the second; this
    // is the first, and it needs a name of its own in the shared vocabulary.
    expect(isSyncRejectionReason('scopeRevoked')).toBe(true)
    expect(rows[0]!.reason as string).toBe('scopeRevoked')

    // The text is still readable where a screen looks for refused work, and
    // nowhere else — the document itself went with the scope.
    const dead = await harness.engine.outbox.listDead({ ownerId: OWNER })
    expect(dead.map((row) => (row.data as SyncPayload).text)).toEqual([
      'written just before the removal',
    ])
    expect(await harness.engine.outbox.listUnsettled({ ownerId: OWNER })).toEqual([])
    expect(await harness.engine.outbox.listPending({ ownerId: OWNER })).toEqual([])
    expect(await countOf(harness.db, 'homework')).toBe(0)
  })

  it('is never pushed afterwards', async () => {
    harness.server.revoke(USER_SCOPE)
    await harness.engine.pull()

    const pushesBefore = harness.server.pushRequests.length
    await harness.engine.runner.run()

    const sent = harness.server.pushRequests
      .slice(pushesBefore)
      .flatMap((request) => request.changes)
    expect(sent).toEqual([])
  })
})

/**
 * The scope a row arrived on, recorded with the row.
 *
 * Which scope brought a row is the server's decision, stamped on the envelope
 * (`sync/journal/projections.ts`), and the device has no way to recompute it:
 * `school_id` and `course_id` describe what a row is *about*, not who was
 * granted it, and the user scope has no column at all. Writing the pair down is
 * what makes erasing one scope a single delete — and what stops the device from
 * carrying a second, silently diverging copy of the server's addressing map.
 */
describe('AC-P43h — the scope a row arrived on travels with the row', () => {
  const ORPHAN_SCOPE: SyncScopeRef = { kind: 'course', id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d' }

  const provenanceOf = async (db: IDatabase, table: string, id: string) => {
    const rows = await db.query<{ scope_kind: string; scope_id: string }>(
      `SELECT scope_kind, scope_id FROM "${table}" WHERE id = ?`,
      [id],
    )

    return rows[0] ?? null
  }

  it("is the envelope's, never one inferred from the columns", async () => {
    const harness = await openHarness()

    // Both rows are addressed against the grain of what their columns suggest:
    // the card on the course, the lesson on the school. A device that guessed
    // from `school_id` and `course_id` would get both of them backwards.
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: { id: COURSE_ID, schoolId: SCHOOL_ID, name: 'Bhagavad-gita', learningType: 'group' },
    })
    harness.server.journal({
      collection: 'lessons',
      docId: LESSON_ID,
      scope: SCHOOL_SCOPE,
      data: {
        id: LESSON_ID,
        schoolId: SCHOOL_ID,
        courseId: COURSE_ID,
        title: 'One',
        lessonNumber: 1,
      },
    })
    await harness.engine.runner.run()

    expect(await provenanceOf(harness.db, 'courses', COURSE_ID)).toEqual({
      scope_kind: 'course',
      scope_id: COURSE_SCOPE.id,
    })
    expect(await provenanceOf(harness.db, 'lessons', LESSON_ID)).toEqual({
      scope_kind: 'school',
      scope_id: SCHOOL_ID,
    })
  })

  it('takes rows that have nothing to be joined through', async () => {
    const harness = await openHarness()

    // Homework and its block states, and no enrolment row anywhere: legal by
    // construction, because scope positions advance independently and the
    // schema has no foreign keys precisely so that a child may arrive first.
    // Erasing through a join leaves exactly these rows behind for good.
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: {
        id: HOMEWORK_ID,
        schoolId: SCHOOL_ID,
        enrollmentId: ENROLLMENT_ID,
        lessonVersionId: LESSON_VERSION_ID,
        sectionId: SECTION_ID,
        status: 'open',
        text: 'answered before the enrolment arrived',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    })
    harness.server.journal({
      collection: 'block_states',
      docId: BLOCK_STATE_ID,
      scope: USER_SCOPE,
      data: {
        id: BLOCK_STATE_ID,
        schoolId: SCHOOL_ID,
        enrollmentId: ENROLLMENT_ID,
        lessonVersionId: LESSON_VERSION_ID,
        blockId: BLOCK_ID,
        state: { watched: true },
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    })
    await harness.engine.runner.run()
    expect(await countOf(harness.db, 'enrollments')).toBe(0)
    expect(await countOf(harness.db, 'homework')).toBe(1)

    harness.server.revoke(USER_SCOPE)
    await harness.engine.runner.run()

    expect(await countOf(harness.db, 'homework')).toBe(0)
    expect(await countOf(harness.db, 'block_states')).toBe(0)
  })

  it('takes the per-document server pointer with it', async () => {
    const harness = await openHarness()
    seed(harness.server)
    await harness.engine.runner.run()
    expect(await harness.engine.apply.lastServerHlc('homework', HOMEWORK_ID)).not.toBeNull()

    harness.server.revoke(USER_SCOPE)
    await harness.engine.runner.run()

    // Left behind, the pointer makes `applyRemote` refuse the same rows as
    // stale when the grant comes back, and the scope returns empty for ever.
    expect(await harness.engine.apply.lastServerHlc('homework', HOMEWORK_ID)).toBeNull()
    expect(await harness.engine.apply.lastServerHlc('block_states', BLOCK_STATE_ID)).toBeNull()
  })

  /**
   * Driven by the collection list rather than by a list written out here, so a
   * collection added to `SyncCollections` is covered the day it is added. The
   * property is the point of recording the pair: erasing a scope is one delete
   * per table by `(scope_kind, scope_id)`, and a new collection needs no branch
   * of its own anywhere — the day it needs one is the day this goes red.
   */
  it('takes every collection there is, with nothing taught about any of them', async () => {
    const harness = await openHarness()

    for (const collection of SyncCollections) {
      harness.server.journal({
        collection,
        docId: docIdFor(collection),
        scope: ORPHAN_SCOPE,
        data: payloadFor(collection),
      })
    }

    await harness.engine.runner.run()
    for (const projection of Object.values(COLLECTION_PROJECTIONS)) {
      expect([projection.table, await countOf(harness.db, projection.table)]).toEqual([
        projection.table,
        1,
      ])
    }

    harness.server.revoke(ORPHAN_SCOPE)
    await harness.engine.runner.run()

    for (const projection of Object.values(COLLECTION_PROJECTIONS)) {
      expect([projection.table, await countOf(harness.db, projection.table)]).toEqual([
        projection.table,
        0,
      ])
    }
  })
})

/** A stable, distinct id per collection — a UUID, as every scope key must be. */
const docIdFor = (collection: string): string => {
  const index = SyncCollections.indexOf(collection as (typeof SyncCollections)[number])
  return `0000000${index}-aaaa-4bbb-8ccc-dddddddddddd`
}

/**
 * A row of `collection` filled straight from its projection.
 *
 * Generated rather than written out, for the same reason the case above is
 * driven by the collection list: a payload table here would have to be extended
 * by hand, and the one property under test is that nothing has to be.
 */
function payloadFor(collection: string): SyncPayload {
  const projection = COLLECTION_PROJECTIONS[collection as (typeof SyncCollections)[number]]
  const payload: Record<string, unknown> = {}

  for (const column of projection.columns) {
    if (column.column === projection.tombstone) continue
    if (column.field === 'id') payload.id = docIdFor(collection)
    else if (column.field === 'schoolId') payload.schoolId = SCHOOL_ID
    else if (column.kind === 'integer') payload[column.field] = 1
    else if (column.kind === 'boolean') payload[column.field] = false
    else if (column.kind === 'json') payload[column.field] = {}
    else if (column.field.endsWith('Id')) payload[column.field] = docIdFor(collection)
    else payload[column.field] = 'something'
  }

  return payload as SyncPayload
}
