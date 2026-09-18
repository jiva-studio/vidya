import type { SyncPayload, SyncScopeRef } from '@vidya/domain'
import { syncScopeKey } from '@vidya/domain'
import { SYNC_MAX_CHANGE_BYTES } from '@vidya/protocol'
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

/** A scope of a kind this build has never heard of, as an old server might grant. */
const ALIEN_SCOPE = { kind: 'group', id: '7f' } as unknown as SyncScopeRef

/** A scope of a kind we know whose id the server could never cast to a uuid. */
const CROOKED_COURSE = { kind: 'course', id: 'not-a-uuid' } as unknown as SyncScopeRef

describe('the seven defects', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
  })

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
})
