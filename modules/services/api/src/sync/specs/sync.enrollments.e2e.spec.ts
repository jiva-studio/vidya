import { INestApplication } from '@nestjs/common'
import { EnrollmentsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { CLOCK } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import { Enrollment } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'
import { v4 as uuid } from 'uuid'

import { createSyncContext, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

/** A fixed moment, so every stamp in the suite sits inside the skew ceiling. */
const NOW = Date.UTC(2026, 8, 18, 0, 0, 0)

const hlc = (physical: number, counter = 0, device = DEVICE): string =>
  `${String(physical).padStart(15, '0')}:${String(counter).padStart(5, '0')}:${device}`

/**
 * A place asked for from a device that was offline.
 *
 * The plan sends this collection both ways — up goes the request, down comes
 * the decision — and the mobile client already journals `enrollments.request`,
 * so the server has to take the row rather than strand it in an outbox that is
 * never emptied.
 */
describe('POST /sync/push: a request for a place on a course', () => {
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

  /** The row the device writes locally: the whole enrolment, as the client has it. */
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
      },
      ...overrides,
    }
  }

  const stored = (docId: string) =>
    ds.getRepository(Enrollment).findOneBy({ id: domain.asId<domain.EnrollmentId>(docId) })

  const storedFor = (courseId: domain.CourseId) =>
    ds.getRepository(Enrollment).findBy({ courseId, studentId: ctx.student.id })

  const journalFor = (docId: string) =>
    ds.query('SELECT hlc, data FROM sync_journal WHERE doc_id = $1 ORDER BY global_seq', [docId])

  const results = async (changes: Partial<protocol.PushChange>[], token = ctx.tokens.student) =>
    ((await push(token, changes).expect(200)).body as protocol.PushResponse).results

  it('takes a request the student made for themselves', async () => {
    const change = asks(ctx.theirs.course.id)

    const [result] = await results([change])

    expect(result.status).toBe('accepted')

    const enrollment = await stored(change.docId)

    expect(enrollment.status).toBe('pending')
    expect(enrollment.studentId).toBe(ctx.student.id)
    expect(enrollment.courseId).toBe(ctx.theirs.course.id)
    expect(enrollment.schoolId).toBe(ctx.schoolId)
    expect(enrollment.decidedById ?? null).toBeNull()

    // The subscriber is the journal's only writer, so the row it wrote is the
    // only row there is — and it carries the device's own stamp.
    const rows = await journalFor(change.docId)

    expect(rows).toHaveLength(1)
    expect(rows[0].hlc).toBe(change.hlc)
  })

  it('refuses a request made in another student name', async () => {
    const change = asks(ctx.theirs.course.id, {
      data: {
        courseId: ctx.theirs.course.id,
        schoolId: ctx.schoolId,
        studentId: ctx.stranger.id,
        status: 'pending',
      },
    })

    const [result] = await results([change])

    expect((result as protocol.PushRejected).reason).toBe('notYourEnrollment')
    expect(await stored(change.docId)).toBeNull()
  })

  it('refuses a request for a course that does not exist', async () => {
    const change = asks(domain.asId<domain.CourseId>(uuid()))

    const [result] = await results([change])

    expect((result as protocol.PushRejected).reason).toBe('malformed')
  })

  it('reads a status the client may not claim as the request it is', async () => {
    const change = asks(ctx.theirs.course.id, {
      data: {
        courseId: ctx.theirs.course.id,
        schoolId: ctx.schoolId,
        studentId: ctx.student.id,
        status: 'accepted',
        decidedById: ctx.student.id,
        decidedAt: new Date(NOW).toISOString(),
        groupId: uuid(),
      },
    })

    const [result] = await results([change])

    // Dropped without a word, exactly as the server fields of homework are.
    expect(result.status).toBe('accepted')

    const enrollment = await stored(change.docId)

    expect(enrollment.status).toBe('pending')
    expect(enrollment.decidedById ?? null).toBeNull()
    expect(enrollment.decidedAt ?? null).toBeNull()
    expect(enrollment.groupId ?? null).toBeNull()
  })

  it('answers the same request twice without asking twice', async () => {
    const change = asks(ctx.theirs.course.id)

    const [first] = await results([change])
    const [again] = await results([change])

    expect(again).toEqual(first)
    expect(await journalFor(change.docId)).toHaveLength(1)
    expect(await storedFor(ctx.theirs.course.id)).toHaveLength(1)
  })

  it('accepts a request for a course the student is already on, and keeps the place', async () => {
    const change = asks(ctx.mine.course.id)

    const [result] = await results([change])

    expect(result.status).toBe('accepted')

    // The device named the request itself, so it arrives under an id the server
    // has never seen; the place it asks for is the one already granted.
    const places = await storedFor(ctx.mine.course.id)

    expect(places).toHaveLength(1)
    expect(places[0].id).toBe(ctx.enrollment.id)
    expect(places[0].status).toBe('accepted')
    expect(await journalFor(change.docId)).toHaveLength(0)
  })

  it('leaves a decision alone when the request that asked for it arrives after it', async () => {
    const change = asks(ctx.theirs.course.id)

    await results([change])

    const enrollments = app.get(EnrollmentsService)
    const decided = await enrollments.moderate(await stored(change.docId), {
      status: 'accepted',
      decidedById: ctx.stranger.id,
    })

    // The device is still carrying the row it wrote offline, under a later stamp.
    const [result] = await results([{ ...change, outboxId: 2, hlc: hlc(NOW - 10_000) }])

    expect(result.status).toBe('accepted')

    const enrollment = await stored(change.docId)

    expect(enrollment.status).toBe('accepted')
    expect(enrollment.decidedById).toBe(ctx.stranger.id)
    expect(enrollment.decidedAt).toEqual(decided.decidedAt)
  })
})
