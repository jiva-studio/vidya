import type {
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  SchoolId,
  SectionId,
  SyncPayload,
  SyncScopeRef,
} from '@vidya/domain'
import { asId, syncScopeKey } from '@vidya/domain'
import { SYNC_MAX_CHANGE_BYTES } from '@vidya/protocol'
import { INCOMPLETE_CHECKSUM, journalHasLocalWrites } from '@vidya/usecases'
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
  USER_SCOPE,
} from './fakeSyncServer'
import { type Harness, openHarness, OWNER } from './harness'

/**
 * The seven defects a hostile review reproduced on this engine, each pinned by
 * the run that showed it.
 *
 * Every one of them is a silence: nothing throws, nothing is logged, and the
 * student sees a screen that is merely wrong — a course that never updates, a
 * lesson that never arrives, an answer that was there a moment ago. So each
 * test states the observable end of the defect and not the mechanism, because
 * the mechanism is what the fix is free to change.
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

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

/** A scope of a kind this build has never heard of, as an old server might grant. */
const ALIEN_SCOPE = { kind: 'group', id: '7f' } as unknown as SyncScopeRef

/** A scope of a kind we know whose id the server could never cast to a uuid. */
const CROOKED_COURSE = { kind: 'course', id: 'not-a-uuid' } as unknown as SyncScopeRef

describe('the seven defects', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
  })

  const scopeState = async (scope: SyncScopeRef) => {
    const scopes = await harness.engine.state.listScopes()
    return scopes.find((state) => syncScopeKey(state.scope) === syncScopeKey(scope)) ?? null
  }

  const lastCursors = () => harness.server.pullRequests.at(-1)!.cursors as Record<string, number>

  it('D-1: a scope this build cannot name is ignored, not written down', async () => {
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })
    harness.server.malformed({ scope: ALIEN_SCOPE, data: homework() })
    harness.server.grant(CROOKED_COURSE)

    await harness.engine.runner.run()

    // Neither the alien kind nor the uncastable id reached the table the pull
    // reads its cursors back out of. One row there is a `400` on every pull
    // from then on, reported as `refused` — ours to fix, nothing to wait for —
    // and no path in this engine ever takes it out again.
    const stored = (await harness.engine.state.listScopes()).map((state) =>
      syncScopeKey(state.scope),
    )
    expect(stored).toEqual([syncScopeKey(COURSE_SCOPE)])

    // The good scope was unaffected: the course is on the device, and the next
    // pull asks about that scope and no other.
    expect(await harness.count('courses')).toBe(1)
    await harness.engine.runner.run()
    expect(Object.keys(lastCursors())).toEqual([syncScopeKey(COURSE_SCOPE)])
  })

  it('D-1: a scope an earlier build already wrote down is never asked about again', async () => {
    await harness.db.execute(
      `INSERT INTO sync_scopes (owner_id, kind, id, cursor, checksum, removed_at)
       VALUES (?, 'group', '7f', 12, NULL, NULL)`,
      [OWNER],
    )
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })

    const result = await harness.engine.runner.run()

    // The very first request of the run is where the poison would show: the
    // cursors are read straight out of that table, and one key the server
    // cannot parse is a `400` — reported as `refused`, never retried on a
    // timer, and nothing deletes the row that caused it.
    expect(Object.keys(harness.server.pullRequests[0]!.cursors)).not.toContain('group:7f')
    expect(result.outcome).toBe('completed')
    expect(await harness.count('courses')).toBe(1)
  })

  it('D-2: a row on the size boundary is stored, because the server measured it too', async () => {
    const shell = JSON.stringify({
      id: LESSON_VERSION_ID,
      lessonId: LESSON_ID,
      version: 3,
      status: 'published',
      content: { schemaVersion: 1, title: '' },
    })

    // A body of exactly the ceiling, in the bytes the server counts — a lesson
    // version whose payload carries no school of its own.
    const title = 'a'.repeat(SYNC_MAX_CHANGE_BYTES - shell.length)
    harness.server.journal({
      collection: 'lesson_versions',
      docId: LESSON_VERSION_ID,
      scope: COURSE_SCOPE,
      data: {
        id: LESSON_VERSION_ID,
        lessonId: LESSON_ID,
        version: 3,
        status: 'published',
        content: { schemaVersion: 1, title },
      },
    })

    const result = await harness.engine.runner.run()

    expect(result.pull?.skipped).toEqual([])
    expect(result.pull?.applied).toBe(1)
    expect(await harness.row('lesson_versions', LESSON_VERSION_ID)).not.toBeNull()
  })

  it('D-3: a page that stepped over a row does not claim the scope is complete', async () => {
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })

    // A row this build cannot store, on the course's scope. Its position still
    // moves past it — a skipped row is handled, not lost — so the only thing
    // left to notice the gap is the checksum.
    harness.server.malformed({ scope: COURSE_SCOPE, collection: 'planets', docId: COURSE_ID })

    const first = await harness.engine.runner.run()
    expect(first.pull?.skipped).toHaveLength(1)

    const scope = await scopeState(COURSE_SCOPE)
    expect(scope!.cursor).toBeGreaterThan(0)
    expect(scope!.checksum).toBe(INCOMPLETE_CHECKSUM)

    // And the detector it exists for does fire: the next run finds a summary
    // that cannot match and refetches that one scope (I-5, AC-10m).
    const second = await harness.engine.runner.run()
    expect(second.resynced.map(syncScopeKey)).toEqual([syncScopeKey(COURSE_SCOPE)])
  })

  it('D-3: a page applied whole records the summary the server sent', async () => {
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })

    const result = await harness.engine.runner.run()

    expect(result.pull?.skipped).toEqual([])
    const scope = await scopeState(COURSE_SCOPE)
    expect(scope!.checksum).not.toBeNull()
    expect(scope!.checksum).not.toBe(INCOMPLETE_CHECKSUM)
    expect(result.resynced).toEqual([])
  })

  it('D-4: enrolling a student again brings the scope back, at the position it reached', async () => {
    harness.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: course(),
    })
    harness.server.grant(USER_SCOPE)
    await harness.engine.runner.run()
    const reached = (await scopeState(COURSE_SCOPE))!.cursor
    expect(reached).toBeGreaterThan(0)

    harness.server.revoke(COURSE_SCOPE)
    await harness.engine.runner.run()
    expect((await scopeState(COURSE_SCOPE))!.removedAt).not.toBeNull()

    // The school enrols them a second time.
    harness.server.grant(COURSE_SCOPE)
    await harness.engine.runner.run()

    const back = await scopeState(COURSE_SCOPE)
    expect(back!.removedAt).toBeNull()
    expect(back!.cursor).toBe(reached)

    // Which is the whole point: the scope is asked about again, from where it
    // stood, rather than read from the beginning on every pull forever.
    await harness.engine.runner.run()
    expect(lastCursors()[syncScopeKey(COURSE_SCOPE)]).toBe(reached)
  })

  it('D-5: a refused row goes on protecting the answer it carries', async () => {
    harness.server.rejectIf = (change) => (change.collection === 'homework' ? 'malformed' : null)

    await harness.engine.homework.saveAnswer(answer('the answer I wrote'))
    await harness.engine.runner.run()

    const rows = await harness.outboxOf(OWNER)
    expect(rows[0]).toMatchObject({ status: 'rejected', reason: 'malformed' })
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('the answer I wrote')

    // The server hands down its own copy of the row, which never received the
    // text — the push that carried it was refused.
    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ status: 'open', text: '' }),
    })
    await harness.engine.runner.run()

    // The work is still on the screen. It exists nowhere else: no code reads a
    // text back out of the outbox (AC-18, AC-19).
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('the answer I wrote')
  })

  it('D-5: work refused as already accepted yields to the copy the teacher graded', async () => {
    harness.server.rejectIf = (change) =>
      change.collection === 'homework' ? 'alreadyAccepted' : null

    await harness.engine.homework.saveAnswer(answer('written after it was marked'))
    await harness.engine.runner.run()

    harness.server.journal({
      collection: 'homework',
      docId: HOMEWORK_ID,
      scope: USER_SCOPE,
      data: homework({ status: 'accepted', text: 'the text that was accepted' }),
    })
    await harness.engine.runner.run()

    // The one refusal that says the text is frozen for good: there is no later
    // push that could deliver the edit, so holding it on top of the server's
    // copy would show an answer nobody will ever read.
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('the text that was accepted')
  })

  it('D-6: a run with nothing to send does not report the journal short of local writes', async () => {
    await harness.engine.homework.saveAnswer(answer('typed once'))
    await harness.engine.runner.run()

    // The next run has nothing to push, which is the ordinary case.
    const result = await harness.engine.runner.run()

    expect(result.push?.sent).toBe(0)
    const latest = await harness.engine.outbox.latestId(OWNER)
    expect(result.push!.journaledOutboxId).toBe(latest)
    expect(journalHasLocalWrites(result.push!.journaledOutboxId, latest)).toBe(true)
  })
})
