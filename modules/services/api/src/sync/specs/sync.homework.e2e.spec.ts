import { INestApplication } from '@nestjs/common'
import { HomeworkService } from '@vidya/api/edu/services'
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

/** A fixed moment, so every stamp in the suite sits inside the skew ceiling. */
const NOW = Date.UTC(2026, 8, 18, 0, 0, 0)

const hlc = (physical: number, counter = 0, device = DEVICE): string =>
  `${String(physical).padStart(15, '0')}:${String(counter).padStart(5, '0')}:${device}`

/**
 * What review does to an answer that arrived from a device.
 *
 * The freeze is not the whole of it: work handed back for revision has to be
 * writable again, and work answered against the text published now must not
 * carry the flag that tells a reviewer to open an older one.
 */
describe('-sync: an answer that has been through review', () => {
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

  const push = (token: string, changes: Partial<protocol.PushChange>[]) =>
    request(app.getHttpServer())
      .post(routes.push())
      .auth(token, { type: 'bearer' })
      .send({ deviceId: DEVICE, changes })

  const results = async (changes: Partial<protocol.PushChange>[], token = ctx.tokens.student) =>
    ((await push(token, changes).expect(200)).body as protocol.PushResponse).results

  /** A well-formed answer from the enrolled student. */
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

  const stored = (docId: string) =>
    ds.getRepository(Homework).findOneBy({ id: domain.asId<domain.HomeworkId>(docId) })

  it('does not flag an answer written against the version published now', async () => {
    const change = answer()

    expect((await results([change]))[0].status).toBe('accepted')

    // Nothing has been published since, so the reviewer has no older text to
    // open and the flag would only be noise.
    expect((await stored(change.docId)).answeredSupersededVersion).toBe(false)
  })

  it('takes a new answer to work that was returned for revision', async () => {
    const change = answer({ data: { text: 'A first attempt.' } })

    await results([change])

    const homework = app.get(HomeworkService)

    await homework.review(await stored(change.docId), {
      status: 'returned',
      reviewerId: ctx.student.id,
    })

    const again = answer({
      outboxId: 2,
      docId: change.docId,
      hlc: hlc(NOW - 50_000),
      data: { text: 'A second attempt, after the notes.' },
    })

    const [result] = await results([again])

    expect(result.status).toBe('accepted')

    // Back in the queue with the new text: returning work is what unfreezes it.
    const work = await stored(change.docId)

    expect(work.status).toBe('pending')
    expect(work.text).toBe('A second attempt, after the notes.')
  })
})
