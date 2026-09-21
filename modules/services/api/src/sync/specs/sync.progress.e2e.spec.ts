import { INestApplication } from '@nestjs/common'
import { EnrollmentsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { CLOCK } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import { BlockState, Enrollment } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { randomUUID } from 'crypto'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { BLOCK_ID, createSyncContext, QUIZ_BLOCK_ID, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

/** The student's other device, so a row this suite pushed is not filtered out of its own pull. */
const OTHER_DEVICE = 'device-2b7c9e01'

/** A fixed moment, so every stamp in the suite sits inside the skew ceiling. */
const NOW = Date.UTC(2026, 8, 18, 0, 0, 0)

const hlc = (physical: number, counter = 0, device = DEVICE): string =>
  `${String(physical).padStart(15, '0')}:${String(counter).padStart(5, '0')}:${device}`

/**
 * How far a student got, travelling from a device and back again.
 *
 * The collection replicates upward only, so the two questions it has to answer
 * are whether the caller holds the place the row names, and whether what one
 * device wrote reaches the student's other devices unchanged.
 */
describe('-sync: progress through a lesson', () => {
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

  const pull = async (deviceId = OTHER_DEVICE): Promise<protocol.PullResponse> =>
    (
      await request(app.getHttpServer())
        .post(routes.pull())
        .auth(ctx.tokens.student, { type: 'bearer' })
        .send({ deviceId, cursors: {} })
        .expect(200)
    ).body as protocol.PullResponse

  const reasonOf = (result: protocol.PushResult) => (result as protocol.PushRejected).reason

  /** How far the device says the student got through one block. */
  const reports = (overrides: Partial<protocol.PushChange> = {}): protocol.PushChange => ({
    outboxId: 1,
    collection: 'block_states',
    docId: randomUUID(),
    op: 'upsert',
    hlc: hlc(NOW - 60_000),
    baseHlc: null,
    ...overrides,
    data: {
      enrollmentId: ctx.enrollment.id,
      lessonVersionId: ctx.mine.published.id,
      blockId: BLOCK_ID,
      state: { type: 'text', read: true },
      ...overrides.data,
    },
  })

  const statesOf = (body: protocol.PullResponse) =>
    body.changes.filter((change) => change.collection === 'block_states')

  /* --------------------------- whose place it is --------------------------- */

  it('refuses progress addressed to another student place', async () => {
    const change = reports({
      data: {
        enrollmentId: ctx.strangerEnrollment.id,
        lessonVersionId: ctx.theirs.published.id,
      },
    })

    const [result] = await results([change])

    expect(reasonOf(result)).toBe('notYourEnrollment')
    expect(await ds.getRepository(BlockState).count()).toBe(0)
  })

  it('refuses progress on a place the school has not granted yet', async () => {
    const change = reports({
      data: {
        enrollmentId: ctx.pendingEnrollment.id,
        lessonVersionId: ctx.theirs.published.id,
      },
    })

    const [result] = await results([change], ctx.tokens.pending)

    expect(reasonOf(result)).toBe('enrollmentRevoked')
    expect(await ds.getRepository(BlockState).count()).toBe(0)
  })

  /* ------------------------------ one row per block ------------------------------ */

  it('a second report of one block replaces the first instead of adding a row', async () => {
    const first = reports({ data: { state: { type: 'text', read: false } } })

    // A device that rebuilt its outbox reissues the row under a fresh id. The
    // natural key `(enrolment, version, block)` names the row that is already
    // there, so the second report must land in it rather than beside it.
    const again = reports({
      outboxId: 2,
      docId: randomUUID(),
      hlc: hlc(NOW - 50_000),
      data: { state: { type: 'text', read: true } },
    })

    expect((await results([first]))[0].status).toBe('accepted')
    expect((await results([again]))[0].status).toBe('accepted')

    const rows = await ds.getRepository(BlockState).findBy({
      enrollmentId: ctx.enrollment.id,
      lessonVersionId: ctx.mine.published.id,
      blockId: BLOCK_ID,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(first.docId)
    expect(rows[0].state).toEqual({ type: 'text', read: true })
  })

  /* ------------------------------ and back down ------------------------------ */

  it('hands a reported block state back to the student other device', async () => {
    const change = reports({ data: { state: { type: 'quiz', answer: 2 } } })

    await results([change])

    const row = statesOf(await pull()).find((candidate) => candidate.docId === change.docId)

    expect(row).toBeDefined()
    expect(row.data).toMatchObject({
      enrollmentId: ctx.enrollment.id,
      lessonVersionId: ctx.mine.published.id,
      blockId: BLOCK_ID,
      state: { type: 'quiz', answer: 2 },
    })
  })

  it('hands back the progress of every place the student holds, without being told an id', async () => {
    const elsewhere = await placeOnTheirCourse()

    const here = reports()
    const there = reports({
      outboxId: 2,
      hlc: hlc(NOW - 50_000),
      data: {
        enrollmentId: elsewhere.id,
        lessonVersionId: ctx.theirs.published.id,
        blockId: QUIZ_BLOCK_ID,
        state: { type: 'quiz', answer: 1 },
      },
    })

    await results([here, there])

    // One pull, no cursors, no enrolment named: both places come back, because
    // a student's rows all live in the one scope that is the student.
    const delivered = statesOf(await pull()).map((change) => change.docId)

    expect(delivered).toContain(here.docId)
    expect(delivered).toContain(there.docId)
  })

  /** A second accepted place, so the student holds two at once. */
  const placeOnTheirCourse = (): Promise<Enrollment> =>
    app.get(EnrollmentsService).create({
      courseId: ctx.theirs.course.id,
      studentId: ctx.student.id,
      schoolId: ctx.schoolId,
      status: 'accepted' as domain.EnrollmentStatus,
    })
})
