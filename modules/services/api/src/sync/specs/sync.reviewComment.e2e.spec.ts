import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import { UsersService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { CLOCK } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import { Homework } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { randomUUID } from 'crypto'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createSyncContext, SECTION_ID, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

/** The student's other device, so a row this suite pushed is not filtered out of its own pull. */
const OTHER_DEVICE = 'device-2b7c9e01'

/** A fixed moment, so every stamp in the suite sits inside the skew ceiling. */
const NOW = Date.UTC(2026, 8, 18, 0, 0, 0)

const COMMENT = 'Name the chapter your quotation comes from, and hand it in again.'

const hlc = (physical: number, counter = 0, device = DEVICE): string =>
  `${String(physical).padStart(15, '0')}:${String(counter).padStart(5, '0')}:${device}`

/**
 * What the reviewer wrote, travelling down to the student who has to act on it.
 *
 * Work handed back without a word is a refusal nobody can answer, so the
 * comment is part of the decision rather than a note beside it. It is the
 * server's field: a device that sends one is describing its own work, not the
 * review of it.
 */
describe('-sync: the words a reviewer sends back', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: SyncContext
  let reviewerToken: string

  beforeEach(async () => {
    app = await createTestingApp([{ provide: CLOCK, useValue: { nowMs: () => NOW } }])
    ds = app.get(DataSource)
    ctx = await createSyncContext(app)

    const reviewer = await app.get(UsersService).create({ email: faker.internet.email() })

    reviewerToken = (
      await app
        .get(AuthService)
        .generateTokens(reviewer.id, [
          { sid: ctx.schoolId, p: ['homework:read', 'homework:grade'] },
        ])
    ).accessToken
  })

  afterEach(async () => {
    await app.close()
  })

  const push = (changes: Partial<protocol.PushChange>[]) =>
    request(app.getHttpServer())
      .post(routes.push())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .send({ deviceId: DEVICE, changes })

  const results = async (changes: Partial<protocol.PushChange>[]) =>
    ((await push(changes).expect(200)).body as protocol.PushResponse).results

  const pull = async (): Promise<protocol.PullResponse> =>
    (
      await request(app.getHttpServer())
        .post(routes.pull())
        .auth(ctx.tokens.student, { type: 'bearer' })
        .send({ deviceId: OTHER_DEVICE, cursors: {} })
        .expect(200)
    ).body as protocol.PullResponse

  const answer = (overrides: Partial<protocol.PushChange> = {}): protocol.PushChange => ({
    outboxId: 1,
    collection: 'homework',
    docId: randomUUID(),
    op: 'upsert',
    hlc: hlc(NOW - 60_000),
    baseHlc: null,
    ...overrides,
    data: {
      enrollmentId: ctx.enrollment.id,
      lessonVersionId: ctx.mine.published.id,
      sectionId: SECTION_ID,
      text: 'My answer, written on the train.',
      submittedAt: new Date(NOW - 60_000).toISOString(),
      ...overrides.data,
    },
  })

  const review = (id: string, body: protocol.ReviewHomeworkRequest) =>
    request(app.getHttpServer())
      .patch(protocol.Routes().edu.homework.review(id))
      .auth(reviewerToken, { type: 'bearer' })
      .send(body)

  /**
   * The latest homework row the pull hands back under `docId`.
   *
   * A pull with no cursors replays the whole journal, so the row appears once
   * per write it has seen; the last one is the state the device ends up in.
   */
  const deliveredWork = async (docId: string): Promise<domain.SyncPayload> => {
    const body = await pull()
    const rows = body.changes.filter(
      (change) => change.collection === 'homework' && change.docId === docId,
    )

    expect(rows.length).toBeGreaterThan(0)

    return rows[rows.length - 1].data
  }

  it('carries the comment on work returned for revision down to the student', async () => {
    const change = answer()

    await results([change])
    await review(change.docId, { status: 'returned', comment: COMMENT }).expect(200)

    expect(await deliveredWork(change.docId)).toMatchObject({ comment: COMMENT })
  })

  it('drops a comment a device sends about its own work', async () => {
    const change = answer({ data: { comment: 'I have marked this acceptable.' } })

    await results([change])

    const stored = await ds
      .getRepository(Homework)
      .findOneBy({ id: change.docId as domain.HomeworkId })

    expect(stored.comment ?? null).toBeNull()
  })
})
