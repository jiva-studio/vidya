import type {
  CourseId,
  EnrollmentId,
  GroupId,
  IsoDateTime,
  PreferredTimes,
  SchoolId,
  SyncPayload,
  UserId,
} from '@vidya/domain'
import { asId, parseIsoDateTime } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import type { IDatabase, IEnrollmentRepository } from '../../../../ports'
import type { UtcClock } from '../../../persistence'
import { openTestDatabase } from '../../../persistence/testing'
import { createSqlBlockStateRepository } from '../blockStatesRepository.sql'
import { createSqlEnrollmentRepository } from '../enrollmentsRepository.sql'
import { createSqlHomeworkRepository } from '../homeworkRepository.sql'
import { createSqlOutboxRepository } from '../outboxRepository.sql'
import { createSqlSyncApplyRepository } from '../syncApplyRepository.sql'
import { withSyncJournaling } from '../syncJournalDecorator'

const OWNER = '7b3d5e90-1c44-4a2b-8f61-2d9e0c4a5b73'
const SOMEBODY_ELSE = asId<UserId>('c4a9f1d6-2b83-4e57-9a10-6d5c3b7e4f28')
const COURSE = asId<CourseId>('b6d40e27-8c31-4a95-b7f2-0e5a1d38c624')
const SCHOOL = asId<SchoolId>('5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915')
const GROUP = asId<GroupId>('1d6c8a35-4b29-4e07-9c58-3a7f2b6d1e40')
const REQUEST = asId<EnrollmentId>('4a7e2c96-0d13-4b58-9f26-3c8b1a5e70d4')
const SECOND_REQUEST = asId<EnrollmentId>('9f3b6d18-7a25-4c94-b8e3-1d5a6c2f8073')

const LAST_YEAR = parseIsoDateTime('2025-09-18T00:00:00.000Z')
const DECIDED_AT = parseIsoDateTime('2026-09-01T12:00:00.000Z')
const TODAY = parseIsoDateTime('2026-09-18T00:00:00.000Z')
const TOMORROW = parseIsoDateTime('2026-09-19T00:00:00.000Z')

const EVENINGS: PreferredTimes = {
  timeZone: 'Europe/Kyiv',
  ranges: [{ days: ['mon', 'wed'], startMinute: 1080, endMinute: 1260 }],
}

let db: IDatabase
let enrollments: IEnrollmentRepository
let clockAt: IsoDateTime
let seq = 0

const clock: UtcClock = () => clockAt

/**
 * The repository as the screens hold it: journaled, over real SQLite.
 *
 * The journal is not a detail of these tests but half of what they state — a
 * write the decorator turns into the wrong kind of outbox row is refused by
 * the server for as long as the device keeps trying.
 */
const openDevice = (owner: string = OWNER): IEnrollmentRepository => {
  const outbox = createSqlOutboxRepository({ db, now: clock })
  const apply = createSqlSyncApplyRepository({ db, ownerId: () => owner, now: clock })

  return withSyncJournaling(
    {
      enrollments: createSqlEnrollmentRepository({ db, ownerId: () => owner, now: clock }),
      homework: createSqlHomeworkRepository({ db, ownerId: () => owner, now: clock }),
      blockStates: createSqlBlockStateRepository({ db, ownerId: () => owner, now: clock }),
    },
    {
      db,
      outbox,
      apply,
      deviceId: async () => 'device-a',
      ownerId: () => owner,
      nowMs: () => Date.parse(clockAt),
    },
  ).enrollments
}

/** The journal, oldest row first, as the push would drain it. */
const journaled = () =>
  createSqlOutboxRepository({ db, now: clock }).listPending({ ownerId: OWNER })

/** What the most recent journal row carries. */
const lastJournaled = async (): Promise<SyncPayload> => {
  const rows = await journaled()
  return rows[rows.length - 1]?.data ?? {}
}

/** Write a decision the way a pull of the student's scope writes it. */
const decide = async (id: EnrollmentId, decision: SyncPayload): Promise<void> => {
  seq += 1
  const apply = createSqlSyncApplyRepository({ db, ownerId: () => OWNER, now: clock })
  const hlc = `00178968920000${seq}:00000:server`
  const stored = await apply.getLocalDoc('enrollments', id)

  await apply.applyRemote(
    'enrollments',
    { docId: id, hlc, deleted: false, data: { ...stored?.data, ...decision, id } },
    hlc,
    { kind: 'user', id: OWNER },
  )
}

const ask = (id: EnrollmentId = REQUEST) =>
  enrollments.request({ id, schoolId: SCHOOL, courseId: COURSE })

const listedIds = async (): Promise<readonly EnrollmentId[]> =>
  (await enrollments.list()).map((item) => item.id)

beforeEach(async () => {
  seq = 0
  clockAt = TODAY
  db = (await openTestDatabase()).db
  enrollments = openDevice()
})

/**
 * Who a locally written request is from.
 *
 * The server refuses a request that names nobody — it has no way to tell a
 * place asked for by this device from one asked for on somebody else's behalf —
 * and a refused row sits in the journal forever. The device is signed in as one
 * student and files every row under that identity, which is the only answer a
 * screen could give anyway.
 */
describe('a request written on the device', () => {
  it('is from the identity the device writes under when it names no student', async () => {
    await ask()

    expect(await enrollments.getById(REQUEST)).toMatchObject({ studentId: OWNER })
  })

  it('keeps the student it was given, so a caller that knows is not overruled', async () => {
    await enrollments.request({
      id: REQUEST,
      schoolId: SCHOOL,
      courseId: COURSE,
      studentId: SOMEBODY_ELSE,
    })

    expect(await enrollments.getById(REQUEST)).toMatchObject({ studentId: SOMEBODY_ELSE })
  })

  it('keeps what the student asked for beside the place itself', async () => {
    await enrollments.request({
      id: REQUEST,
      schoolId: SCHOOL,
      courseId: COURSE,
      preferredGroupId: GROUP,
      preferredTimes: EVENINGS,
      comment: 'I travel on Fridays.',
    })

    expect(await enrollments.getById(REQUEST)).toMatchObject({
      preferredGroupId: GROUP,
      preferredTimes: EVENINGS,
      comment: 'I travel on Fridays.',
    })
  })

  it('names the student’s stamp in the journal even when nothing is put away', async () => {
    // A field the payload omits is a field the merge deletes, so the empty
    // stamp travels as an explicit `null` rather than as a missing key.
    await ask()

    const data = (await journaled())[0]?.data ?? {}
    expect('archivedByStudentAt' in data).toBe(true)
    expect(data.archivedByStudentAt).toBeNull()
  })
})

describe('withdrawing a request', () => {
  it('journals the withdrawal as a change to the row, not as its removal', async () => {
    await ask()
    await enrollments.withdraw(REQUEST)

    const rows = await journaled()
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ collection: 'enrollments', docId: REQUEST, op: 'upsert' })
    expect(rows[1]?.data).toMatchObject({ status: 'withdrawn' })
  })

  it('puts the row away in the same write that ends it', async () => {
    await ask()
    clockAt = TOMORROW
    await enrollments.withdraw(REQUEST)

    expect(await enrollments.getById(REQUEST)).toMatchObject({
      status: 'withdrawn',
      archivedByStudentAt: TOMORROW,
      deletedAt: null,
    })
  })

  it('takes the withdrawn request out of the student’s list', async () => {
    await ask()
    await enrollments.withdraw(REQUEST)

    expect(await listedIds()).toEqual([])
  })
})

describe('the live request for a course', () => {
  it('answers with the live row rather than the newest one', async () => {
    await ask()
    clockAt = TOMORROW
    await ask(SECOND_REQUEST)
    await enrollments.withdraw(SECOND_REQUEST)

    expect(await enrollments.getLiveByCourse(COURSE)).toMatchObject({ id: REQUEST })
  })

  it('answers with nothing when every request for the course is finished', async () => {
    await ask()
    await enrollments.withdraw(REQUEST)

    expect(await enrollments.getLiveByCourse(COURSE)).toBeNull()
  })

  it('takes the newest of two live requests, which a pull will then settle', async () => {
    await ask()
    clockAt = TOMORROW
    await ask(SECOND_REQUEST)

    expect(await enrollments.getLiveByCourse(COURSE)).toMatchObject({ id: SECOND_REQUEST })
  })
})

describe('putting a finished request away', () => {
  it('journals the stamp, so the other device hears about it too', async () => {
    await ask()
    await decide(REQUEST, { status: 'declined', decidedAt: DECIDED_AT })
    clockAt = TOMORROW
    await enrollments.archive(REQUEST)

    const rows = await journaled()
    expect(rows[rows.length - 1]).toMatchObject({ docId: REQUEST, op: 'upsert' })
    expect(await lastJournaled()).toMatchObject({ archivedByStudentAt: TOMORROW })
  })

  it('journals the undo, naming the emptied stamp explicitly', async () => {
    await ask()
    await decide(REQUEST, { status: 'declined', decidedAt: DECIDED_AT })
    await enrollments.archive(REQUEST)
    await enrollments.unarchive(REQUEST)

    const data = await lastJournaled()
    expect('archivedByStudentAt' in data).toBe(true)
    expect(data.archivedByStudentAt).toBeNull()
  })

  it('brings the row back when the student undoes it', async () => {
    await ask()
    await decide(REQUEST, { status: 'declined', decidedAt: DECIDED_AT })
    await enrollments.archive(REQUEST)
    await enrollments.unarchive(REQUEST)

    expect(await listedIds()).toEqual([REQUEST])
  })

  it('is still away after the application is started again', async () => {
    const images = new Map<string, Uint8Array>()
    const first = await openTestDatabase({ images })
    db = first.db
    enrollments = openDevice()
    await ask()
    await decide(REQUEST, { status: 'declined', decidedAt: DECIDED_AT })
    await enrollments.archive(REQUEST)
    await first.db.close()

    db = (await openTestDatabase({ images })).db
    enrollments = openDevice()

    expect(await listedIds()).toEqual([])
  })
})

/**
 * What the student's list shows.
 *
 * One predicate: a row is hidden when the student put it away and it is
 * finished. Nothing in it reads a clock — two instants would need a rule about
 * which is later, and there is none.
 */
describe('the student’s list', () => {
  it('hides a finished request the student put away', async () => {
    await ask()
    await decide(REQUEST, { status: 'declined', decidedAt: DECIDED_AT })
    await enrollments.archive(REQUEST)

    expect(await listedIds()).toEqual([])
  })

  it('keeps a finished request the student has not put away', async () => {
    await ask()
    await decide(REQUEST, { status: 'revoked', decidedAt: DECIDED_AT })

    expect(await listedIds()).toEqual([REQUEST])
  })

  it('keeps a live request carrying a stamp it should never have carried', async () => {
    // The server forbids the stamp on a live row; the list refuses to hide one
    // anyway, because a place hidden here cannot be got back from any screen.
    await ask()
    await decide(REQUEST, { status: 'accepted', archivedByStudentAt: TODAY })

    expect(await listedIds()).toEqual([REQUEST])
  })

  it('hides a row whose stamp is older than the decision that finished it', async () => {
    await ask()
    await decide(REQUEST, {
      status: 'declined',
      decidedAt: DECIDED_AT,
      archivedByStudentAt: LAST_YEAR,
    })

    expect(await listedIds()).toEqual([])
  })

  it('hides a row whose stamp is newer than the decision that finished it', async () => {
    await ask()
    await decide(REQUEST, {
      status: 'declined',
      decidedAt: DECIDED_AT,
      archivedByStudentAt: TOMORROW,
    })

    expect(await listedIds()).toEqual([])
  })

  it('shows the row again once a new decision cleared the stamp', async () => {
    await ask()
    await decide(REQUEST, { status: 'declined', decidedAt: DECIDED_AT })
    await enrollments.archive(REQUEST)

    // The school answered again, and the same write that carries the answer
    // empties the stamp. The row is finished either way, so nothing but the
    // emptied stamp can bring it back.
    await decide(REQUEST, {
      status: 'revoked',
      decidedAt: TOMORROW,
      archivedByStudentAt: null,
    })

    expect(await listedIds()).toEqual([REQUEST])
  })

  it('keeps one identity’s requests out of another’s reach', async () => {
    await ask()

    expect(await openDevice('owner-2').list()).toEqual([])
  })
})
