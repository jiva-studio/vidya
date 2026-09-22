import { INestApplication } from '@nestjs/common'
import { EnrollmentsService, GroupsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { CLOCK } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { randomUUID } from 'crypto'
import * as request from 'supertest'

import { BLOCK_ID, createSyncContext, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

/** The student's other device, so a row this suite pushed is not filtered out of its own pull. */
const OTHER_DEVICE = 'device-2b7c9e01'

/** A fixed moment, so every stamp in the suite sits inside the skew ceiling. */
const NOW = Date.UTC(2026, 8, 18, 0, 0, 0)

const hlc = (physical: number, counter = 0, device = DEVICE): string =>
  `${String(physical).padStart(15, '0')}:${String(counter).padStart(5, '0')}:${device}`

/** An instant written as UTC, which is the only form the device is given. */
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/**
 * What one pull with no cursors hands a student.
 *
 * A device asks by holding a token, never by naming a row: every place the
 * student holds and every stamp on it has to arrive on its own. The stamps are
 * checked as text, not as dates, because the client parses what is on the wire
 * — a local offset there moves a deadline to another day.
 */
describe('-sync: what a pull hands a student', () => {
  let app: INestApplication
  let ctx: SyncContext

  beforeEach(async () => {
    app = await createTestingApp([{ provide: CLOCK, useValue: { nowMs: () => NOW } }])
    ctx = await createSyncContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const pull = async (deviceId = OTHER_DEVICE): Promise<protocol.PullResponse> =>
    (
      await request(app.getHttpServer())
        .post(routes.pull())
        .auth(ctx.tokens.student, { type: 'bearer' })
        .send({ deviceId, cursors: {} })
        .expect(200)
    ).body as protocol.PullResponse

  const changesIn = async (collection: domain.SyncCollection) =>
    (await pull()).changes.filter((change) => change.collection === collection)

  /**
   * The last row the page carries for one document.
   *
   * A row edited after it was created is journalled twice, and the page hands
   * over both in order; what the device ends up holding is the last of them.
   */
  const latestOf = async (collection: domain.SyncCollection, docId: string) => {
    const rows = (await changesIn(collection)).filter((change) => change.docId === docId)

    expect(rows.length).toBeGreaterThan(0)

    return rows[rows.length - 1]
  }

  /** How far the device says the student got through one block. */
  const reportProgress = async (): Promise<string> => {
    const docId = randomUUID()

    await request(app.getHttpServer())
      .post(routes.push())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .send({
        deviceId: DEVICE,
        changes: [
          {
            outboxId: 1,
            collection: 'block_states',
            docId,
            op: 'upsert',
            hlc: hlc(NOW - 60_000),
            baseHlc: null,
            data: {
              enrollmentId: ctx.enrollment.id,
              lessonVersionId: ctx.mine.published.id,
              blockId: BLOCK_ID,
              state: { type: 'text', read: true },
            },
          },
        ],
      })
      .expect(200)

    return docId
  }

  /* -------------------------------- places -------------------------------- */

  it('hands back every place the student holds, without being told an id', async () => {
    const elsewhere = await app.get(EnrollmentsService).create({
      courseId: ctx.theirs.course.id,
      studentId: ctx.student.id,
      schoolId: ctx.schoolId,
      status: 'accepted' as domain.EnrollmentStatus,
    })

    const delivered = (await changesIn('enrollments')).map((change) => change.docId)

    expect(delivered).toContain(ctx.enrollment.id)
    expect(delivered).toContain(elsewhere.id)
  })

  it('hands back an accepted place with the group it was given', async () => {
    const group = await app.get(GroupsService).create({
      name: 'Tuesday evenings',
      courseId: ctx.mine.course.id,
      schoolId: ctx.schoolId,
      status: 'pending' as domain.GroupStatus,
    })

    await app.get(EnrollmentsService).assignGroup(ctx.enrollment, group.id)

    const row = await latestOf('enrollments', ctx.enrollment.id)

    expect(row.data).toMatchObject({ status: 'accepted', groupId: group.id })
  })

  /* -------------------------------- stamps -------------------------------- */

  it('dates a place as a UTC instant', async () => {
    const row = await latestOf('enrollments', ctx.enrollment.id)

    expect(row.data.createdAt).toEqual(expect.any(String))
    expect(row.data.createdAt).toMatch(UTC_INSTANT)
  })

  it('dates progress as a UTC instant', async () => {
    const docId = await reportProgress()
    const row = await latestOf('block_states', docId)

    expect(row.data.updatedAt).toEqual(expect.any(String))
    expect(row.data.updatedAt).toMatch(UTC_INSTANT)
  })

  it('dates a publication as a UTC instant', async () => {
    const row = await latestOf('lesson_versions', ctx.mine.published.id)

    expect(row.data.publishedAt).toEqual(expect.any(String))
    expect(row.data.publishedAt).toMatch(UTC_INSTANT)
  })
})
