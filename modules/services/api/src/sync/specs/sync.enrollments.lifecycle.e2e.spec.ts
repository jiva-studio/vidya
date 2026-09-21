import { INestApplication } from '@nestjs/common'
import { EnrollmentsService, GroupsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { testDatabase } from '@vidya/api/shared/datasources'
import { CLOCK } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import { Enrollment, Group } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'
import { v4 as uuid } from 'uuid'

import { createSyncContext, SECTION_ID, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

/** A fixed moment, so every stamp in the suite sits inside the skew ceiling. */
const NOW = Date.UTC(2026, 8, 18, 0, 0, 0)

const hlc = (physical: number, counter = 0, device = DEVICE): string =>
  `${String(physical).padStart(15, '0')}:${String(counter).padStart(5, '0')}:${device}`

const EVENING: domain.PreferredTimes = {
  timeZone: 'Europe/Berlin',
  ranges: [{ days: ['mon', 'wed'], startMinute: 1080, endMinute: 1200 }],
}

/**
 * pg-mem runs one session and does not model two transactions meeting, so the
 * last line of defence — the partial unique index — can only be asked of a
 * real server.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

/**
 * What a device may still change about a place it already holds.
 *
 * A request is not the end of the collection's upward direction: the student
 * cancels, leaves, and puts a finished row away, all of it offline. The row
 * the server holds carries the school's answer, so each of those pushes meets
 * a decision it may or may not have seen.
 */
describe('POST /sync/push: a place a student already asked for', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: SyncContext

  beforeEach(async () => {
    app = await createTestingApp([{ provide: CLOCK, useValue: { nowMs: () => NOW } }])
    ds = app.get(DataSource)
    ctx = await createSyncContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const push = (token: string, changes: Partial<protocol.PushChange>[], deviceId = DEVICE) =>
    request(app.getHttpServer())
      .post(routes.push())
      .auth(token, { type: 'bearer' })
      .send({ deviceId, changes })

  const results = async (changes: Partial<protocol.PushChange>[], token = ctx.tokens.student) =>
    ((await push(token, changes).expect(200)).body as protocol.PushResponse).results

  /** What another device of the same student reads back. */
  const pull = async (deviceId: string): Promise<protocol.PullResponse> =>
    (
      await request(app.getHttpServer())
        .post(routes.pull())
        .auth(ctx.tokens.student, { type: 'bearer' })
        .send({ deviceId, cursors: {} })
        .expect(200)
    ).body as protocol.PullResponse

  const reasonOf = (result: protocol.PushResult) => (result as protocol.PushRejected).reason

  /** A request for a place, as the device writes it into its own table. */
  const asks = (
    courseId: domain.CourseId,
    overrides: Partial<protocol.PushChange> = {},
  ): protocol.PushChange => {
    const docId = overrides.docId ?? uuid()

    return {
      outboxId: 1,
      collection: 'enrollments',
      docId,
      op: 'upsert',
      hlc: hlc(NOW - 60_000),
      baseHlc: null,
      ...overrides,
      data: {
        id: docId,
        courseId,
        schoolId: ctx.schoolId,
        studentId: ctx.student.id,
        groupId: null,
        status: 'pending',
        decidedById: null,
        decidedAt: null,
        createdAt: new Date(NOW - 60_000).toISOString(),
        ...overrides.data,
      },
    }
  }

  /**
   * The row as the device holds it, which is what a push carries.
   *
   * Taken from the stored row on purpose: a device that has pulled knows the
   * school's answer, and the stamp it echoes back is what tells a deliberate
   * change apart from one written before the answer arrived.
   */
  const carries = (
    row: Enrollment,
    data: Record<string, unknown>,
    overrides: Partial<protocol.PushChange> = {},
  ): protocol.PushChange => ({
    outboxId: 7,
    collection: 'enrollments',
    docId: row.id,
    op: 'upsert',
    hlc: hlc(NOW - 10_000, 1),
    baseHlc: null,
    data: {
      id: row.id,
      courseId: row.courseId,
      schoolId: row.schoolId,
      studentId: row.studentId,
      groupId: row.groupId ?? null,
      status: row.status,
      decidedById: row.decidedById ?? null,
      decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      ...data,
    },
    ...overrides,
  })

  const stored = (docId: string) =>
    ds.getRepository(Enrollment).findOneBy({ id: domain.asId<domain.EnrollmentId>(docId) })

  const storedFor = (courseId: domain.CourseId) =>
    ds.getRepository(Enrollment).findBy({ courseId, studentId: ctx.student.id })

  const groupOn = async (courseId: domain.CourseId, status: domain.GroupStatus): Promise<Group> =>
    app
      .get(GroupsService)
      .create({ name: `Group ${uuid()}`, courseId, schoolId: ctx.schoolId, status })

  /** A place asked for and answered, so the row carries a decision to echo. */
  const decided = async (
    status: domain.EnrollmentStatus,
    courseId: domain.CourseId = ctx.theirs.course.id,
  ): Promise<Enrollment> => {
    const change = asks(courseId)
    await results([change])

    const enrollments = app.get(EnrollmentsService)
    await enrollments.moderate(await stored(change.docId), {
      status: status as 'accepted' | 'declined',
      decidedById: ctx.stranger.id,
    })

    return stored(change.docId)
  }

  /* ---------------------------- what a request says --------------------------- */

  it('takes the group, the times and the comment a request carries', async () => {
    const group = await groupOn(ctx.theirs.course.id, 'pending')
    const change = asks(ctx.theirs.course.id, {
      data: {
        preferredGroupId: group.id,
        preferredTimes: EVENING,
        comment: 'Evenings suit me best.',
      },
    })

    const [result] = await results([change])

    expect(result.status).toBe('accepted')

    const enrollment = await stored(change.docId)

    expect(enrollment.preferredGroupId).toBe(group.id)
    expect(enrollment.preferredTimes).toEqual(EVENING)
    expect(enrollment.comment).toBe('Evenings suit me best.')
  })

  it('refuses a preferred range that ends before it starts', async () => {
    const change = asks(ctx.theirs.course.id, {
      data: {
        preferredTimes: {
          timeZone: 'Europe/Berlin',
          ranges: [{ days: ['mon'], startMinute: 1200, endMinute: 1200 }],
        },
      },
    })

    const [result] = await results([change])

    expect(reasonOf(result)).toBe('malformed')
    expect(await stored(change.docId)).toBeNull()
  })

  it('refuses a request asking for more ranges than a week holds', async () => {
    const ranges = Array.from({ length: 9 }, (_, index) => ({
      days: ['mon'],
      startMinute: index * 60,
      endMinute: index * 60 + 30,
    }))

    const change = asks(ctx.theirs.course.id, {
      data: { preferredTimes: { timeZone: 'Europe/Berlin', ranges } },
    })

    const [result] = await results([change])

    expect(reasonOf(result)).toBe('malformed')

    // Over the ceiling is a shape the school cannot read, not a row too big to
    // carry: `payloadTooLarge` would send the device looking for a size to cut.
    expect(JSON.stringify(result)).not.toContain('payloadTooLarge')

    // And it says where the ceiling is, so the student is told how many ranges
    // to leave rather than that their week is unreadable.
    expect((result as protocol.PushRejected).detail).toContain(String(domain.MAX_TIME_RANGES))
    expect(await stored(change.docId)).toBeNull()
  })

  it('refuses a preferred group the school has never heard of', async () => {
    const change = asks(ctx.theirs.course.id, { data: { preferredGroupId: uuid() } })

    const [result] = await results([change])

    expect(reasonOf(result)).toBe('malformed')
    expect(await stored(change.docId)).toBeNull()
  })

  it('refuses a preferred group that is not named with a uuid', async () => {
    const change = asks(ctx.theirs.course.id, { data: { preferredGroupId: 'the morning one' } })

    const [result] = await results([change])

    expect(reasonOf(result)).toBe('malformed')
    expect(await stored(change.docId)).toBeNull()
  })

  it('carries the times a request asked for back to the student other device', async () => {
    const change = asks(ctx.theirs.course.id, { data: { preferredTimes: EVENING } })

    await results([change])

    const page = await pull('device-2b7c9e01')
    const row = page.changes.find(
      (candidate) => candidate.collection === 'enrollments' && candidate.docId === change.docId,
    )

    expect(row).toBeDefined()
    expect(row.data.preferredTimes).toEqual(EVENING)
  })

  it('refuses a preferred group that belongs to another course', async () => {
    const elsewhere = await groupOn(ctx.mine.course.id, 'pending')
    const change = asks(ctx.theirs.course.id, { data: { preferredGroupId: elsewhere.id } })

    const [result] = await results([change])

    expect(reasonOf(result)).toBe('malformed')
    expect(await stored(change.docId)).toBeNull()
  })

  it('keeps a request whose preferred group has been retired', async () => {
    const retired = await groupOn(ctx.theirs.course.id, 'inactive')
    const change = asks(ctx.theirs.course.id, { data: { preferredGroupId: retired.id } })

    const [result] = await results([change])

    expect(result.status).toBe('accepted')

    const enrollment = await stored(change.docId)

    expect(enrollment.status).toBe('pending')
    expect(enrollment.preferredGroupId).toBe(retired.id)
  })

  it('keeps a request whose preferred group has closed its intake', async () => {
    const closed = await groupOn(ctx.theirs.course.id, 'active')
    const change = asks(ctx.theirs.course.id, { data: { preferredGroupId: closed.id } })

    const [result] = await results([change])

    expect(result.status).toBe('accepted')

    const enrollment = await stored(change.docId)

    // The wish stays a wish: the school places the student wherever it can.
    expect(enrollment.status).toBe('pending')
    expect(enrollment.preferredGroupId).toBe(closed.id)
  })

  /* ------------------------- cancelling and leaving ------------------------- */

  it('takes a cancellation of a request the school has not answered', async () => {
    const change = asks(ctx.theirs.course.id)
    await results([change])

    const row = await stored(change.docId)
    const [result] = await results([
      carries(row, {
        status: 'withdrawn',
        archivedByStudentAt: new Date(NOW - 10_000).toISOString(),
      }),
    ])

    expect(result.status).toBe('accepted')

    const enrollment = await stored(change.docId)

    expect(enrollment.status).toBe('withdrawn')
    expect(enrollment.archivedByStudentAt).not.toBeNull()
  })

  it('takes a student leaving a course the school accepted them onto', async () => {
    const group = await groupOn(ctx.theirs.course.id, 'active')
    const placed = await decided('accepted')

    // The student has to be standing in a group for leaving to take them out of one.
    await app.get(EnrollmentsService).assignGroup(placed, group.id)

    const row = await stored(placed.id)

    expect(row.groupId).toBe(group.id)

    const [result] = await results([
      carries(row, {
        status: 'withdrawn',
        archivedByStudentAt: new Date(NOW - 10_000).toISOString(),
      }),
    ])

    expect(result.status).toBe('accepted')

    const enrollment = await stored(row.id)

    expect(enrollment.status).toBe('withdrawn')
    expect(enrollment.groupId ?? null).toBeNull()
    expect(enrollment.decidedAt).toEqual(row.decidedAt)
  })

  it('refuses a cancellation written before the school decided', async () => {
    const row = await decided('accepted')

    // The device was still holding the row as it stood when it went offline:
    // asked for, unanswered. That is what makes this a stale cancellation and
    // not a departure.
    const [result] = await results([
      carries(row, {
        status: 'withdrawn',
        decidedAt: null,
        decidedById: null,
        archivedByStudentAt: new Date(NOW - 10_000).toISOString(),
      }),
    ])

    expect(reasonOf(result)).toBe('alreadyAccepted')

    const enrollment = await stored(row.id)

    expect(enrollment.status).toBe('accepted')
    expect(enrollment.archivedByStudentAt ?? null).toBeNull()
  })

  it('creates nothing when a cancellation names a row the server never stored', async () => {
    const change = asks(ctx.theirs.course.id, {
      data: {
        status: 'withdrawn',
        archivedByStudentAt: new Date(NOW - 10_000).toISOString(),
      },
    })

    const [result] = await results([change])

    expect(reasonOf(result)).toBe('alreadyAccepted')
    expect(await stored(change.docId)).toBeNull()
    expect(await storedFor(ctx.theirs.course.id)).toHaveLength(0)
  })

  /* --------------------------- a place is a history -------------------------- */

  it('opens a second row when a student asks again after a finished one', async () => {
    const first = await decided('declined')
    const again = asks(ctx.theirs.course.id)

    const [result] = await results([again])

    expect(result.status).toBe('accepted')

    const rows = await storedFor(ctx.theirs.course.id)

    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.id === first.id).status).toBe('declined')
    expect(rows.find((row) => row.id === again.docId).status).toBe('pending')
  })

  it('keeps one live place when the same course is asked for under two names', async () => {
    const first = asks(ctx.theirs.course.id)
    await results([first])

    const second = asks(ctx.theirs.course.id, { outboxId: 2, hlc: hlc(NOW - 50_000) })
    const [result] = await results([second])

    expect(result.status).toBe('accepted')
    expect((result as protocol.PushAccepted).serverDocId).toBe(first.docId)
    expect(await storedFor(ctx.theirs.course.id)).toHaveLength(1)
  })

  it('does not restate a finished row as a fresh request', async () => {
    const finished = await decided('declined')
    const later = asks(ctx.theirs.course.id)
    await results([later])

    // The device replays the outbox row it wrote when it first asked: still
    // `pending`, still unaware that the school ever answered.
    const [result] = await results([
      carries(finished, { status: 'pending', decidedAt: null, decidedById: null }, { outboxId: 9 }),
    ])

    expect(reasonOf(result)).toBe('alreadyAccepted')

    const rows = await storedFor(ctx.theirs.course.id)

    expect(rows.find((row) => row.id === finished.id).status).toBe('declined')
    expect(rows.find((row) => row.id === finished.id).decidedAt).toEqual(finished.decidedAt)
    expect(rows.filter((row) => domain.isLive(row.status))).toHaveLength(1)
  })

  /* ---------------------------- putting a row away --------------------------- */

  it('refuses an archiving stamp on a request that is still open', async () => {
    const change = asks(ctx.theirs.course.id)
    await results([change])

    const row = await stored(change.docId)
    const [result] = await results([
      carries(row, { archivedByStudentAt: new Date(NOW - 10_000).toISOString() }),
    ])

    expect(reasonOf(result)).toBe('malformed')
    expect((await stored(row.id)).archivedByStudentAt ?? null).toBeNull()
  })

  it('refuses an archiving stamp on a place the student still holds', async () => {
    const row = await decided('accepted')

    const [result] = await results([
      carries(row, { archivedByStudentAt: new Date(NOW - 10_000).toISOString() }),
    ])

    expect(reasonOf(result)).toBe('malformed')

    const enrollment = await stored(row.id)

    expect(enrollment.status).toBe('accepted')
    expect(enrollment.archivedByStudentAt ?? null).toBeNull()
  })

  it('takes an emptied stamp on a finished row as the undoing of putting it away', async () => {
    const row = await decided('declined')

    await results([carries(row, { archivedByStudentAt: new Date(NOW - 20_000).toISOString() })])

    expect((await stored(row.id)).archivedByStudentAt).not.toBeNull()

    const [result] = await results([
      carries(row, { archivedByStudentAt: null }, { outboxId: 8, hlc: hlc(NOW - 5_000, 2) }),
    ])

    expect(result.status).toBe('accepted')

    const enrollment = await stored(row.id)

    expect(enrollment.archivedByStudentAt ?? null).toBeNull()
    expect(enrollment.status).toBe('declined')
  })

  it('leaves the stamp where it is when a push says nothing about it', async () => {
    const row = await decided('declined')

    await results([carries(row, { archivedByStudentAt: new Date(NOW - 20_000).toISOString() })])

    const stamped = (await stored(row.id)).archivedByStudentAt

    // An absent key and a key holding `null` are two different sentences: the
    // first has nothing to say about the stamp, the second empties it.
    const [result] = await results([
      carries(row, { comment: 'still interested' }, { outboxId: 9, hlc: hlc(NOW - 4_000, 3) }),
    ])

    expect(result.status).toBe('accepted')
    expect((await stored(row.id)).archivedByStudentAt).toEqual(stamped)
  })

  /* --------------------------- one batch, two writes -------------------------- */

  it('applies a request and the cancellation behind it, sent as one batch', async () => {
    const ask = asks(ctx.theirs.course.id)
    const leave = asks(ctx.theirs.course.id, {
      docId: ask.docId,
      outboxId: 2,
      hlc: hlc(NOW - 50_000),
      data: {
        status: 'withdrawn',
        archivedByStudentAt: new Date(NOW - 50_000).toISOString(),
      },
    })

    const [asked, left] = await results([ask, leave])

    expect([asked.status, left.status]).toEqual(['accepted', 'accepted'])

    const enrollment = await stored(ask.docId)

    expect(enrollment.status).toBe('withdrawn')
    expect(enrollment.archivedByStudentAt).not.toBeNull()
  })

  it('lands a departure sent under a name the server answered with another', async () => {
    const online = asks(ctx.theirs.course.id)
    await results([online])

    // A second device names the same place itself: the request resolves onto
    // the row already there, and the departure behind it travels under a name
    // the server never took. It is the same place either way, and a student
    // who has left has left.
    const ask = asks(ctx.theirs.course.id, { outboxId: 3, hlc: hlc(NOW - 40_000) })
    const leave = asks(ctx.theirs.course.id, {
      docId: ask.docId,
      outboxId: 4,
      hlc: hlc(NOW - 30_000),
      data: {
        status: 'withdrawn',
        archivedByStudentAt: new Date(NOW - 30_000).toISOString(),
      },
    })

    const [asked, left] = await results([ask, leave])

    expect(asked).toMatchObject({ status: 'accepted', serverDocId: online.docId })
    expect(left).toMatchObject({ status: 'accepted', serverDocId: online.docId })

    const rows = await storedFor(ctx.theirs.course.id)

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(online.docId)
    expect(rows[0].status).toBe('withdrawn')
    expect(rows[0].archivedByStudentAt).not.toBeNull()
  })

  /* ------------------------------ what it costs ------------------------------ */

  it('refuses homework for a place the student has given back', async () => {
    const place = ctx.enrollment

    await results([
      carries(place, {
        status: 'withdrawn',
        archivedByStudentAt: new Date(NOW - 10_000).toISOString(),
      }),
    ])

    const [result] = await results([
      {
        outboxId: 11,
        collection: 'homework',
        docId: uuid(),
        op: 'upsert',
        hlc: hlc(NOW - 5_000, 2),
        baseHlc: null,
        data: {
          enrollmentId: place.id,
          lessonVersionId: ctx.mine.published.id,
          sectionId: SECTION_ID,
          text: 'Written after I left.',
          submittedAt: new Date(NOW - 5_000).toISOString(),
        },
      },
    ])

    expect(reasonOf(result)).toBe('enrollmentRevoked')
  })
})

describeOnPostgres('POST /sync/push: a place asked for while another is being written', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: SyncContext

  beforeEach(async () => {
    app = await createTestingApp([{ provide: CLOCK, useValue: { nowMs: () => NOW } }])
    ds = app.get(DataSource)
    ctx = await createSyncContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const ask = (device: string) => {
    const docId = uuid()

    return request(app.getHttpServer())
      .post(routes.push())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .send({
        deviceId: device,
        changes: [
          {
            outboxId: 1,
            collection: 'enrollments',
            docId,
            op: 'upsert',
            hlc: hlc(NOW - 60_000, 0, device),
            baseHlc: null,
            data: {
              id: docId,
              courseId: ctx.theirs.course.id,
              schoolId: ctx.schoolId,
              studentId: ctx.student.id,
              status: 'pending',
              createdAt: new Date(NOW - 60_000).toISOString(),
            },
          },
        ],
      })
  }

  const placesOnTheirs = () =>
    ds
      .getRepository(Enrollment)
      .findBy({ courseId: ctx.theirs.course.id, studentId: ctx.student.id })

  /**
   * Waits until some backend of this database is stuck behind a lock.
   *
   * The push is what is stuck: its insert has met a live place another session
   * holds uncommitted, and Postgres makes it wait for that session to end
   * rather than failing it straight away. Seeing the wait is what makes the
   * order of the two an observed fact rather than a hopeful sleep.
   */
  const awaitBlockedBackend = async (): Promise<void> => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const [{ blocked }] = await ds.query(
        `SELECT count(*)::int AS blocked FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'`,
      )

      if (blocked > 0) return

      await new Promise((resolve) => setTimeout(resolve, 25))
    }

    throw new Error('the push never waited on the live-place index')
  }

  it('names the reason when the place appears between the check and the write', async () => {
    const runner = ds.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()

    // Written as plain SQL, and from a session of its own: this row stands for
    // the other device's request, and the push must not be able to see it until
    // it is already committed to writing its own.
    await runner.query(
      `INSERT INTO enrollments ("id", "courseId", "studentId", "schoolId", "status", "createdAt")
       VALUES ($1, $2, $3, $4, 'pending', now())`,
      [uuid(), ctx.theirs.course.id, ctx.student.id, ctx.schoolId],
    )

    // Supertest sends nothing until the request is subscribed to, and this one
    // has to be in flight while the other session still holds its row.
    const answered = ask('device-11112222').then((response) => response)

    try {
      await awaitBlockedBackend()
    } finally {
      await runner.commitTransaction()
      await runner.release()
    }

    const [result] = ((await answered).body as protocol.PushResponse).results

    // The index is the last line, and what it refuses has to reach the student
    // as an answer. `malformed` would strand the outbox row for good.
    expect((result as protocol.PushRejected).reason).toBe('alreadyAccepted')
    expect(await placesOnTheirs()).toHaveLength(1)
  })

  it('writes one row when a dozen devices ask at once', async () => {
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) => ask(`device-${String(index).padStart(8, '0')}`)),
    )
    const answers = responses.map((response) => (response.body as protocol.PushResponse).results[0])

    expect(await placesOnTheirs()).toHaveLength(1)

    for (const answer of answers) {
      if (answer.status === 'rejected') expect(answer.reason).toBe('alreadyAccepted')
    }

    expect(answers.filter((answer) => answer.status === 'accepted').length).toBeGreaterThanOrEqual(
      1,
    )
  })
})
