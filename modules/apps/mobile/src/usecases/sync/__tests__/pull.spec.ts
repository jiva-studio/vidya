import type { HomeworkId, SyncPayload } from '@vidya/domain'
import { asId, syncScopeKey } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import { openTestDatabase } from '@/infra/persistence/testing'

import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
  serverHlc,
  USER_SCOPE,
} from './fakeSyncServer'
import { failingDatabase, type Harness, openHarness, OWNER } from './harness'

/**
 * Pulling and merging:,
 *, and the crooked-data family ….
 *
 * All of it against real SQLite, because the claims are about transactions,
 * cursors and what survives a rollback — none of which a fake repository has.
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

const version = (fields: SyncPayload = {}): SyncPayload => ({
  id: LESSON_VERSION_ID,
  schoolId: SCHOOL_ID,
  lessonId: LESSON_ID,
  version: 3,
  status: 'published',
  content: { schemaVersion: 1, sections: [] },
  ...fields,
})

const course = (fields: SyncPayload = {}): SyncPayload => ({
  id: COURSE_ID,
  schoolId: SCHOOL_ID,
  name: 'Bhagavad-gita',
  learningType: 'group',
  ...fields,
})

const answerKey = {
  enrollmentId: asId<never>(ENROLLMENT_ID),
  lessonVersionId: asId<never>(LESSON_VERSION_ID),
  sectionId: asId<never>(SECTION_ID),
}

describe('pulling a page', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
  })

  it('applying a pull journals nothing — there is no echo', async () => {
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ text: 'from the other phone' }),
    })

    await harness.engine.runner.run()

    expect(await harness.count('outbox')).toBe(0)
    expect(harness.server.pushRequests.flatMap((request) => request.changes)).toEqual([])
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('from the other phone')
  })

  it('an incoming row below the recorded HLC does not roll the document back', async () => {
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      hlc: serverHlc(500),
      data: homework({ text: 'tuesday' }),
    })
    await harness.engine.runner.run()
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('tuesday')

    // The backfill hands over current state while the journal hands over
    // history; monday must not land on top of tuesday.
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      hlc: serverHlc(100),
      data: homework({ text: 'monday' }),
    })
    const result = await harness.engine.runner.run()

    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('tuesday')
    expect(result.pull?.stale).toBe(1)
    expect(result.pull?.applied).toBe(0)
  })

  it('an arriving review status does not wipe out unsent text', async () => {
    await harness.engine.homework.saveAnswer({
      id: asId<HomeworkId>(HOMEWORK_ID),
      schoolId: asId<never>(SCHOOL_ID),
      ...answerKey,
      text: 'not sent yet',
    })

    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ status: 'in_review', text: 'an older copy', grade: null }),
    })

    // Pull only. A full run would push the answer first, and then there would
    // be no unsent write left to protect — which is a different test.
    await harness.engine.pull()

    expect(harness.server.pushRequests).toHaveLength(0)

    const row = await harness.row('homework', HOMEWORK_ID)
    expect(row!.text).toBe('not sent yet')
    expect(row!.status).toBe('in_review')
  })

  it('a lesson version tombstone does not take the homework with it', async () => {
    harness.server.journal({
      collection: 'lesson_versions',
      docId: LESSON_VERSION_ID,
      scope: COURSE_SCOPE,
      data: version(),
    })
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ text: 'answered against version 3' }),
    })
    await harness.engine.runner.run()

    harness.server.journal({
      collection: 'lesson_versions',
      docId: LESSON_VERSION_ID,
      scope: COURSE_SCOPE,
      op: 'delete',
    })
    await harness.engine.runner.run()

    const tombstoned = await harness.row('lesson_versions', LESSON_VERSION_ID)
    expect(tombstoned!.deleted_at).not.toBeNull()

    const answer = await harness.row('homework', HOMEWORK_ID)
    expect(answer).not.toBeNull()
    expect(answer!.text).toBe('answered against version 3')
  })

  it('a child arriving before its parent applies, and the whole page stands', async () => {
    // Homework rides the `user` scope, the version rides `course`. The
    // positions move independently, so this order is legal.
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ text: 'answered early' }),
    })

    const result = await harness.engine.runner.run()

    expect(result.pull?.applied).toBe(1)
    expect(await harness.row('homework', HOMEWORK_ID)).not.toBeNull()
    // The parent is simply absent; the reader says so rather than throwing.
    expect(await harness.engine.lessonVersions.getById(asId<never>(LESSON_VERSION_ID))).toBeNull()
  })

  it('the transaction does not outlive one page', async () => {
    harness.server.pageSize = 1
    for (let index = 0; index < 3; index += 1) {
      harness.server.journal({
        collection: 'lessons',
        docId: lessonId(index),
        scope: COURSE_SCOPE,
        data: { id: lessonId(index), schoolId: SCHOOL_ID, courseId: COURSE_ID, title: `L${index}` },
      })
    }

    // The app goes to the background after the first page. If the run held one
    // transaction across the pages, the committed page would not be there.
    harness.server.onPull = async (index) => {
      if (index === 1) await harness.db.suspend()
    }

    const first = await harness.engine.runner.run()
    expect(first.outcome).toBe('paused')
    expect(await harness.count('lessons')).toBe(1)

    harness.db.resume()
    harness.server.onPull = null
    const second = await harness.engine.runner.run()

    expect(second.outcome).toBe('completed')
    expect(await harness.count('lessons')).toBe(3)
    // Resumed from the stored position, not from the beginning.
    expect(harness.server.pullRequests[1]!.cursors[syncScopeKey(COURSE_SCOPE)]).toBe(1)
  })

  it('the scope position and the page commit together', async () => {
    const database = await openTestDatabase()
    const executed: string[] = []

    // The position write, and only the position write. `addScope` inserts into
    // the same table but runs before the page has written anything, so staging
    // the crash on the table name would fire on the first statement of the
    // transaction — with no domain row written yet, an empty database afterwards
    // says nothing about whether the two halves are tied together.
    const broken = await openHarness({
      db: failingDatabase(database.db, (sql) => {
        executed.push(sql)
        return sql.includes('DO UPDATE SET cursor')
      }),
      server: harness.server,
    })
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })

    await broken.engine.runner.run()

    // The page got as far as the guard: the course was written, and the
    // statement that failed is the one that would have recorded its arrival.
    expect(executed.some((sql) => sql.includes('INSERT INTO courses'))).toBe(true)
    expect(executed.some((sql) => sql.includes('DO UPDATE SET cursor'))).toBe(true)

    // Neither half survived. Move the positions out of the transaction and the
    // course stays on the device with nothing recording that it arrived — the
    // gap the next pull will never ask for.
    expect(await broken.count('courses')).toBe(0)
    expect(await broken.count('sync_scopes')).toBe(0)
  })

  it('hasMore with an empty page stops the loop instead of spinning', async () => {
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })
    await harness.engine.runner.run()

    const before = harness.server.pullRequests.length
    harness.server.alwaysHasMore = true
    const result = await harness.engine.runner.run()

    expect(harness.server.pullRequests.length - before).toBe(1)
    expect(result.pull?.pages).toBe(1)
    expect(result.pull?.reachedEnd).toBe(false)
  })
})

describe('crooked data from the server', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
    // A scope the device already knows, so a page cannot count as progress
    // merely by reporting a new one.
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })
    harness.server.grant(USER_SCOPE)
    await harness.engine.runner.run()
  })

  const skipped = async (): Promise<string[]> => {
    const result = await harness.engine.runner.run()
    return (result.pull?.skipped ?? []).map((row) => row.reason)
  }

  it('an unknown collection is skipped, the position still advances', async () => {
    harness.server.malformed({ collection: 'grimoires', scope: USER_SCOPE })

    expect(await skipped()).toEqual(['unknownCollection'])
    const scopes = await harness.engine.state.listScopes()
    expect(scopes.find((scope) => scope.scope.kind === 'user')!.cursor).toBeGreaterThan(0)
  })

  it('an unknown field is ignored and the row still lands', async () => {
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ text: 'fine', astrologicalSign: 'libra' }),
    })

    const result = await harness.engine.runner.run()
    expect(result.pull?.applied).toBe(1)
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('fine')
  })

  it('a row missing a field that addresses it is skipped', async () => {
    harness.server.malformed({
      collection: 'homework',
      scope: USER_SCOPE,
      data: { id: HOMEWORK_ID, schoolId: SCHOOL_ID, text: 'no enrolment, no section' },
    })

    expect(await skipped()).toEqual(['missingField'])
    expect(await harness.count('homework')).toBe(0)
  })

  it('an upsert with null data is skipped', async () => {
    harness.server.malformed({
      collection: 'homework',
      scope: USER_SCOPE,
      op: 'upsert',
      data: null,
    })
    expect(await skipped()).toEqual(['missingData'])
  })

  it('an unparseable HLC is skipped', async () => {
    harness.server.malformed({ scope: USER_SCOPE, hlc: 'yesterday', data: homework() })
    expect(await skipped()).toEqual(['invalidHlc'])
  })

  it('a docId that is not a uuid is skipped', async () => {
    harness.server.malformed({ scope: USER_SCOPE, docId: 'the-one-i-wrote', data: homework() })
    expect(await skipped()).toEqual(['invalidDocId'])
  })

  it('an unknown content schemaVersion is stored whole, not truncated', async () => {
    harness.server.journal({
      collection: 'lesson_versions',
      docId: LESSON_VERSION_ID,
      scope: COURSE_SCOPE,
      data: version({ content: { schemaVersion: 99, sections: [], newShape: ['?'] } }),
    })

    await harness.engine.runner.run()
    const stored = await harness.engine.lessonVersions.getById(asId<never>(LESSON_VERSION_ID))

    expect(stored!.content).toMatchObject({ schemaVersion: 99, newShape: ['?'] })
  })

  it('an unfamiliar status value is stored as it came', async () => {
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ status: 'awaiting_oracle' }),
    })

    await harness.engine.runner.run()
    expect((await harness.row('homework', HOMEWORK_ID))!.status).toBe('awaiting_oracle')
  })

  it('a duplicated serverSeq on one page applies once', async () => {
    const payload = homework({ text: 'said twice' })
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: payload,
    })
    harness.server.malformed({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      serverSeq: harness.server.rows.at(-1)!.serverSeq,
      hlc: harness.server.rows.at(-1)!.hlc,
      data: payload,
    })

    const result = await harness.engine.runner.run()

    expect(result.pull?.applied).toBe(1)
    expect(result.pull?.stale).toBe(1)
    expect(await harness.count('homework')).toBe(1)
  })

  it('rows out of sequence still leave the position at the maximum', async () => {
    harness.server.malformed({
      collection: 'lessons',
      docId: lessonId(1),
      scope: COURSE_SCOPE,
      serverSeq: 900,
      data: { id: lessonId(1), schoolId: SCHOOL_ID, courseId: COURSE_ID, title: 'later' },
    })
    harness.server.malformed({
      collection: 'lessons',
      docId: lessonId(2),
      scope: COURSE_SCOPE,
      serverSeq: 400,
      data: { id: lessonId(2), schoolId: SCHOOL_ID, courseId: COURSE_ID, title: 'earlier' },
    })

    await harness.engine.runner.run()

    const scopes = await harness.engine.state.listScopes()
    expect(scopes.find((scope) => scope.scope.kind === 'course')!.cursor).toBe(900)
  })

  it('an oversized payload is refused with a reason, not a crash', async () => {
    harness.server.malformed({
      collection: 'lesson_versions',
      docId: LESSON_VERSION_ID,
      scope: COURSE_SCOPE,
      data: version({ content: { schemaVersion: 1, sections: ['x'.repeat(1_100_000)] } }),
    })

    expect(await skipped()).toEqual(['payloadTooLarge'])
    expect(await harness.count('lesson_versions')).toBe(0)
  })

  it('unicode, emoji and RTL survive the round trip unchanged', async () => {
    const text = 'श्री · 🙏🏽 · مرحبا · שלום'
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ text }),
    })

    await harness.engine.runner.run()
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe(text)
  })

  it('a very long answer hits the ceiling with a reason', async () => {
    harness.server.malformed({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ text: '🙏'.repeat(300_000) }),
    })

    expect(await skipped()).toEqual(['payloadTooLarge'])
  })

  it('empty strings and empty arrays are stored, not defaulted away', async () => {
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ text: '', grade: null, submittedAt: null, reviewedById: null }),
    })
    harness.server.journal({
      collection: 'lesson_versions',
      docId: LESSON_VERSION_ID,
      scope: COURSE_SCOPE,
      data: version({ content: { schemaVersion: 1, sections: [] }, publishedAt: null }),
    })

    await harness.engine.runner.run()

    const answer = await harness.row('homework', HOMEWORK_ID)
    expect(answer!.text).toBe('')
    expect(answer!.grade).toBeNull()

    const stored = await harness.engine.lessonVersions.getById(asId<never>(LESSON_VERSION_ID))
    expect(stored!.content.sections).toEqual([])
    expect(stored!.publishedAt).toBeNull()
  })

  it('instants are stored in UTC and the device time zone changes nothing', async () => {
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ submittedAt: '2026-09-17T23:30:00.000Z' }),
    })

    await harness.engine.runner.run()
    const stored = await harness.row('homework', HOMEWORK_ID)

    expect(stored!.submitted_at).toBe('2026-09-17T23:30:00.000Z')
    expect(String(stored!.submitted_at)).toMatch(/Z$/)
  })
})

/** Ids that differ in their last digit and are still valid uuids. */
const lessonId = (index: number): string =>
  `c92b48e1-0f77-4d35-a8b2-6e1d3c05f4${String(80 + index).padStart(2, '0')}`

/** Every outbox row belongs to the identity that wrote it, and only that one. */
export const ownerOf = OWNER
