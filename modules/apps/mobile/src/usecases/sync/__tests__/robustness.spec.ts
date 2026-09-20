import type {
  CourseId,
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  SchoolId,
  SectionId,
  SyncPayload,
} from '@vidya/domain'
import { asId, compareHlcString, parseHlc, syncScopeKey } from '@vidya/domain'
import { SYNC_CLOCK_SKEW_TOLERANCE_MS } from '@vidya/protocol'
import { SyncTransportError } from '@vidya/usecases'
import { beforeEach, describe, expect, it } from 'vitest'

import { openTestDatabase } from '@/infra/persistence/testing'

import {
  COURSE_ID,
  COURSE_SCOPE,
  ENROLLMENT_ID,
  HOMEWORK_ID,
  LESSON_VERSION_ID,
  SCHOOL_ID,
  SECTION_ID,
  USER_SCOPE,
} from './fakeSyncServer'
import { type Harness, openHarness, OWNER } from './harness'

/**
 * What happens to the engine from outside, and what it owes anyway.
 *
 * A dropped connection, a week with no signal, a clock somebody set by hand,
 * a second handset, a reinstall. None of them is a bug to be fixed once; they
 * are the conditions the engine runs in, and each one is proved here rather
 * than assumed. §11, "Железность движка" (#43).
 */

const DAY_MS = 24 * 60 * 60 * 1000

const answer = (text: string) => ({
  id: asId<HomeworkId>(HOMEWORK_ID),
  schoolId: asId<SchoolId>(SCHOOL_ID),
  enrollmentId: asId<EnrollmentId>(ENROLLMENT_ID),
  lessonVersionId: asId<LessonVersionId>(LESSON_VERSION_ID),
  sectionId: asId<SectionId>(SECTION_ID),
  text,
})

const lesson = (id: string, title: string): SyncPayload => ({
  id,
  schoolId: SCHOOL_ID,
  courseId: COURSE_ID,
  title,
  lessonNumber: 1,
})

const drop = () => {
  throw new SyncTransportError('unreachable', 'the connection dropped')
}

const cursorOf = async (harness: Harness, scope = COURSE_SCOPE): Promise<number> => {
  const scopes = await harness.engine.state.listScopes()
  const found = scopes.find((state) => syncScopeKey(state.scope) === syncScopeKey(scope))
  return found?.cursor ?? 0
}

const homeworkRows = (harness: Harness) =>
  harness.server.rows.filter((row) => row.collection === 'homework')

describe('AC-P43d — a pull that dropped between pages', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
    harness.server.pageSize = 1
    for (const [index, title] of ['One', 'Two', 'Three'].entries()) {
      harness.server.journal({
        collection: 'lessons',
        docId: `0000000${index}-0000-4000-8000-000000000000`,
        scope: COURSE_SCOPE,
        data: lesson(`0000000${index}-0000-4000-8000-000000000000`, title),
      })
    }
  })

  it('does not move the position onto a page it never applied', async () => {
    // The first page lands and commits; the second never arrives.
    harness.server.onPull = (index) => {
      if (index === 1) drop()
    }

    const result = await harness.engine.runner.run()

    expect(result.outcome).toBe('retryLater')

    // One row applied, and the position covers exactly that row — not the page
    // that was asked for and never read.
    expect(await harness.count('lessons')).toBe(1)
    expect(await cursorOf(harness)).toBe(1)
  })

  it('carries the rest of it whole on the repeat, without duplicating', async () => {
    harness.server.onPull = (index) => {
      if (index === 1) drop()
    }
    await harness.engine.runner.run()

    harness.server.onPull = null
    const again = await harness.engine.runner.run()

    expect(again.outcome).toBe('completed')
    expect(await harness.count('lessons')).toBe(3)
    expect(await cursorOf(harness)).toBe(3)

    // And it is settled: a third run finds nothing left to apply.
    const third = await harness.engine.runner.run()
    expect(third.pull?.applied).toBe(0)
    expect(await harness.count('lessons')).toBe(3)
  })
})

describe('AC-P43e — a week with no signal', () => {
  it('keeps the queue in order and loses none of it', async () => {
    const harness = await openHarness()
    const written: string[] = []

    // Seven days, two edits a day, with the network never once answering.
    for (let day = 0; day < 7; day += 1) {
      harness.nowMs = 1_789_689_600_000 + day * DAY_MS
      for (const slot of ['morning', 'evening']) {
        const text = `day ${day + 1}, ${slot}`
        written.push(text)
        await harness.engine.homework.saveAnswer(answer(text))
        harness.nowMs += 60_000
      }
    }

    const queued = await harness.outboxOf(OWNER)
    expect(queued).toHaveLength(written.length)
    expect(queued.map((row) => (row.data as SyncPayload).text)).toEqual(written)

    // Insertion order is the contract, and the stamps agree with it: two edits
    // of one document must reach the school in the order they were made.
    expect(queued.map((row) => row.id)).toEqual(
      [...queued.map((row) => row.id)].sort((a, b) => a - b),
    )
    for (let index = 1; index < queued.length; index += 1) {
      expect(compareHlcString(queued[index]!.hlc, queued[index - 1]!.hlc)).toBeGreaterThan(0)
    }

    // The signal comes back — a week later on the school's clock too.
    harness.server.serverNowMs = harness.nowMs
    const result = await harness.engine.runner.run()

    expect(result.push).toMatchObject({ sent: written.length, rejected: 0 })
    expect(harness.server.pushRequests[0]!.changes.map((change) => change.outboxId)).toEqual(
      queued.map((row) => row.id),
    )
    expect(homeworkRows(harness)).toHaveLength(written.length)
    expect((await harness.outboxOf(OWNER)).every((row) => row.status === 'pushed')).toBe(true)
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe(written.at(-1))
  })
})

describe('AC-P43f — a clock somebody set by hand', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await openHarness()
  })

  it('a drift inside the tolerance changes no decision', async () => {
    harness.nowMs = harness.server.serverNowMs + SYNC_CLOCK_SKEW_TOLERANCE_MS - 1000

    await harness.engine.homework.saveAnswer(answer('a minute or two fast'))
    await harness.engine.runner.run()

    const row = (await harness.outboxOf(OWNER))[0]!
    expect(row.status).toBe('pushed')

    // Stored under the stamp it was sent with, and that is the pointer the
    // device keeps.
    expect(homeworkRows(harness)[0]!.hlc).toBe(row.hlc)
    expect(await harness.engine.apply.lastServerHlc('homework', HOMEWORK_ID)).toBe(row.hlc)
  })

  it('a clock put back is safe, because a stamp never goes back with it', async () => {
    await harness.engine.homework.saveAnswer(answer('before the clock moved'))
    await harness.engine.runner.run()
    const first = (await harness.outboxOf(OWNER))[0]!

    // Somebody sets the phone back an hour.
    harness.nowMs -= 60 * 60 * 1000
    await harness.engine.homework.saveAnswer(answer('after the clock moved'))

    const second = (await harness.outboxOf(OWNER))[1]!
    expect(compareHlcString(second.hlc, first.hlc)).toBeGreaterThan(0)

    await harness.engine.runner.run()

    // Both edits are on record, in the order they were written, and the later
    // text is the one the document holds.
    expect(homeworkRows(harness)).toHaveLength(2)
    expect((await harness.outboxOf(OWNER)).every((row) => row.status === 'pushed')).toBe(true)
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe('after the clock moved')
  })

  it('a clock far ahead is pulled back by the school, and the device adopts that stamp', async () => {
    harness.nowMs = harness.server.serverNowMs + SYNC_CLOCK_SKEW_TOLERANCE_MS + 60_000

    await harness.engine.homework.saveAnswer(answer('written by a phone a year fast'))
    await harness.engine.runner.run()

    const sent = (await harness.outboxOf(OWNER))[0]!
    expect(parseHlc(sent.hlc).physical).toBe(harness.nowMs)

    // The work is kept — refusing it would throw away what the student wrote —
    // but not under the stamp that would anchor every other device in the
    // future. This is the behaviour, not an absence of one.
    const stored = homeworkRows(harness)[0]!
    expect(stored.hlc).not.toBe(sent.hlc)
    expect(parseHlc(stored.hlc)).toMatchObject({
      physical: harness.server.serverNowMs,
      deviceId: 'server',
    })
    expect(await harness.engine.apply.lastServerHlc('homework', HOMEWORK_ID)).toBe(stored.hlc)
    expect((await harness.row('homework', HOMEWORK_ID))!.text).toBe(
      'written by a phone a year fast',
    )
  })

  it('two handsets sharing a device id do not swallow one another writes', async () => {
    // What a phone restored from another one backup produces: the same device
    // id, so the same stamps, on two different answers.
    const restored = await openHarness({
      db: (await openTestDatabase()).db,
      server: harness.server,
    })

    await harness.engine.homework.saveAnswer(answer('written on the first handset'))
    await restored.engine.homework.saveAnswer(answer('written on the second'))

    expect((await restored.outboxOf(OWNER))[0]!.hlc).toBe((await harness.outboxOf(OWNER))[0]!.hlc)

    await harness.engine.runner.run()
    await restored.engine.runner.run()

    // Both survive: the idempotency key is the stamp *and* the body, so the
    // second answer is restamped rather than mistaken for a repeat of the first.
    expect(homeworkRows(harness)).toHaveLength(2)
    expect(homeworkRows(harness).map((row) => (row.data as SyncPayload).text)).toEqual([
      'written on the first handset',
      'written on the second',
    ])
  })
})

describe('AC-P43g — two handsets of one student on one row', () => {
  /** Both write the same document offline; `first` reaches the school first. */
  const raceThem = async (first: 'a' | 'b') => {
    const server = (await openHarness()).server
    const deviceA = await openHarness({ server, deviceId: 'device-a' })
    const deviceB = await openHarness({
      db: (await openTestDatabase()).db,
      server,
      deviceId: 'device-b',
    })

    await deviceA.engine.homework.saveAnswer(answer('from device a'))
    await deviceB.engine.homework.saveAnswer(answer('from device b'))

    const order = first === 'a' ? [deviceA, deviceB] : [deviceB, deviceA]
    for (const device of order) await device.engine.runner.run()

    // Then each hears what the other said.
    for (const device of [...order].reverse()) await device.engine.runner.run()

    return {
      a: (await deviceA.row('homework', HOMEWORK_ID))!.text,
      b: (await deviceB.row('homework', HOMEWORK_ID))!.text,
      stamps: {
        a: (await deviceA.outboxOf(OWNER))[0]!.hlc,
        b: (await deviceB.outboxOf(OWNER))[0]!.hlc,
      },
    }
  }

  it('settle on the same text whichever of them was heard first', async () => {
    const aFirst = await raceThem('a')
    const bFirst = await raceThem('b')

    expect(aFirst.a).toBe(aFirst.b)
    expect(bFirst.a).toBe(bFirst.b)
    expect(aFirst.a).toBe(bFirst.a)
  })

  it('settle on the stamp `compareHlc` calls greater, which here is the device id', async () => {
    const raced = await raceThem('a')

    // Same millisecond, same counter: only the device id separates them, and it
    // separates them the same way on both handsets and on every later run.
    const { a, b } = raced.stamps
    expect(parseHlc(a).physical).toBe(parseHlc(b).physical)
    expect(parseHlc(a).counter).toBe(parseHlc(b).counter)
    expect(compareHlcString(b, a)).toBeGreaterThan(0)

    expect(raced.a).toBe('from device b')
  })
})

describe('AC-P43i — the app installed again', () => {
  it('rebuilds the whole state from the school, with nothing left over', async () => {
    const original = await openHarness()
    original.server.journal({
      collection: 'courses',
      docId: COURSE_ID,
      scope: COURSE_SCOPE,
      data: { id: COURSE_ID, schoolId: SCHOOL_ID, name: 'Bhagavad-gita', learningType: 'group' },
    })
    original.server.journal({
      collection: 'lessons',
      docId: LESSON_VERSION_ID,
      scope: COURSE_SCOPE,
      data: lesson(LESSON_VERSION_ID, 'Chapter one'),
    })
    original.server.grant(USER_SCOPE)

    await original.engine.homework.saveAnswer(answer('written before the reinstall'))
    await original.engine.runner.run()
    expect((await original.outboxOf(OWNER))[0]!.status).toBe('pushed')

    // The app is deleted and installed again: a database with nothing in it and
    // an installation id this school has never seen.
    const fresh = await openHarness({
      db: (await openTestDatabase()).db,
      server: original.server,
      deviceId: 'device-after-reinstall',
    })

    expect(await fresh.count('courses')).toBe(0)
    expect(await fresh.allOutboxRows()).toEqual([])

    await fresh.engine.runner.run()

    // Everything is back, the answer this student pushed from the old handset
    // included — it is the school's copy now, and the school hands it over.
    expect((await fresh.engine.courses.list()).map((row) => row.name)).toEqual(['Bhagavad-gita'])
    expect(await fresh.engine.lessons.listByCourse(asId<CourseId>(COURSE_ID))).toHaveLength(1)
    expect((await fresh.row('homework', HOMEWORK_ID))!.text).toBe('written before the reinstall')

    // And nothing of the old installation is carried in: no queued work, no
    // refusals to show, and a second run finds the state already complete.
    expect(await fresh.allOutboxRows()).toEqual([])
    expect(await fresh.engine.outbox.listUnsettled({ ownerId: OWNER })).toEqual([])
    expect(await fresh.engine.outbox.listDead({ ownerId: OWNER })).toEqual([])
    expect((await fresh.engine.runner.run()).pull?.applied).toBe(0)
  })
})
