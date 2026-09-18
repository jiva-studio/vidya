import { SYNC_MAX_CHANGE_BYTES } from '@vidya/protocol'
import { beforeEach, describe, expect, it } from 'vitest'

import { COURSE_SCOPE, LESSON_ID, LESSON_VERSION_ID } from './fakeSyncServer'
import { type Harness, openHarness } from './harness'

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

describe('the seven defects', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
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
