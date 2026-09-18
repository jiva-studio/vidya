import { INestApplication } from '@nestjs/common'
import { HomeworkService, LessonVersionsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { CLOCK, isServerDeviceId } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import { BlockState, Homework } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'
import { v4 as uuid } from 'uuid'

import { BLOCK_ID, createSyncContext, SECTION_ID, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

/** A fixed moment, so the skew ceiling is a number this suite can stand either side of. */
const NOW = Date.UTC(2026, 8, 18, 0, 0, 0)

const hlc = (physical: number, counter = 0, device = DEVICE): string =>
  `${String(physical).padStart(15, '0')}:${String(counter).padStart(5, '0')}:${device}`

describe('POST /sync/push', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: SyncContext
  let now: number

  beforeEach(async () => {
    now = NOW
    app = await createTestingApp([{ provide: CLOCK, useValue: { nowMs: () => now } }])
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

  /** A well-formed answer from the enrolled student, on a brand new document. */
  const answer = (overrides: Partial<protocol.PushChange> = {}): protocol.PushChange => ({
    outboxId: 1,
    collection: 'homework',
    docId: uuid(),
    op: 'upsert',
    hlc: hlc(NOW - 60_000),
    baseHlc: null,
    data: {
      enrollmentId: ctx.enrollment.id,
      lessonVersionId: ctx.mine.published.id,
      sectionId: SECTION_ID,
      text: 'My answer, written on the train.',
      submittedAt: new Date(NOW - 60_000).toISOString(),
    },
    ...overrides,
  })

  const progress = (overrides: Partial<protocol.PushChange> = {}): protocol.PushChange => ({
    outboxId: 2,
    collection: 'block_states',
    docId: uuid(),
    op: 'upsert',
    hlc: hlc(NOW - 59_000, 1),
    baseHlc: null,
    data: {
      enrollmentId: ctx.enrollment.id,
      lessonVersionId: ctx.mine.published.id,
      blockId: BLOCK_ID,
      state: { type: 'text', read: true },
    },
    ...overrides,
  })

  const storedAnswer = (docId: string) =>
    ds.getRepository(Homework).findOneBy({ id: domain.asId<domain.HomeworkId>(docId) })

  const storedProgress = (docId: string) =>
    ds.getRepository(BlockState).findOneBy({ id: domain.asId<domain.BlockStateId>(docId) })

  const journalFor = (docId: string) =>
    ds.query('SELECT hlc, data FROM sync_journal WHERE doc_id = $1 ORDER BY global_seq', [docId])

  /* ------------------------------- T-S-19 ------------------------------- */

  it('T-S-19: answers a mixed batch row by row and applies the accepted ones', async () => {
    const good = answer()
    const rejected = { ...answer({ outboxId: 3 }), collection: 'courses' as const }

    const response = await push(ctx.tokens.student, [good, progress(), rejected]).expect(200)
    const body = response.body as protocol.PushResponse

    expect(body.results.map((r) => r.status)).toEqual(['accepted', 'accepted', 'rejected'])
    expect(await storedAnswer(good.docId)).not.toBeNull()

    // The write checkpoint is the highest accepted row, so the interface can
    // refuse to paint a state that does not yet contain the answer (I-6).
    expect(body.journaledOutboxId).toBe(2)
  })

  /* ------------------------------- T-S-20 ------------------------------- */

  it('T-S-20: results match the changes in length and in order', async () => {
    const changes = [
      answer({ outboxId: 10 }),
      { ...answer({ outboxId: 11 }), collection: 'lessons' as const },
      progress({ outboxId: 12 }),
    ]

    const body = (await push(ctx.tokens.student, changes).expect(200)).body as protocol.PushResponse

    expect(body.results).toHaveLength(3)
    expect(body.results.map((r) => r.outboxId)).toEqual([10, 11, 12])
    expect(body.results.map((r) => r.docId)).toEqual(changes.map((c) => c.docId))
  })

  /* ------------------------------- T-S-21 ------------------------------- */

  it('T-S-21: the same row pushed twice is accepted without being applied twice', async () => {
    const change = answer()

    const first = (await push(ctx.tokens.student, [change]).expect(200))
      .body as protocol.PushResponse
    const written = await storedAnswer(change.docId)

    // The connection dropped and the device retried, a minute later by its own
    // clock. The gap matters: `updatedAt` is stamped from the server clock, so
    // a second application of the row would move it. Pushing the identical row
    // at the identical instant could not tell "answered from the journal" apart
    // from "applied all over again".
    now = NOW + 60_000

    const second = (await push(ctx.tokens.student, [change]).expect(200))
      .body as protocol.PushResponse

    expect(second.results[0]).toEqual(first.results[0])
    expect(await journalFor(change.docId)).toHaveLength(1)

    // Nothing was touched at all: the repeat was answered from the journal
    // before the applier was reached (D-3).
    const after = await storedAnswer(change.docId)
    expect(after.updatedAt.getTime()).toBe(written.updatedAt.getTime())
  })

  it('T-S-21: a repeat that does reach the table is absorbed by the index', async () => {
    const first = answer({ data: { ...answer().data, text: 'Written on the train.' } })

    // The same answer to the same section under a second document id — a device
    // that rebuilt its outbox reissues the row with a fresh id and the stamp it
    // had. The natural key `(enrolment, version, section)` sends it to the row
    // the first push already journalled under that stamp, so the insert this
    // time really does collide and must not raise (D-3).
    const again = answer({
      outboxId: 2,
      docId: uuid(),
      hlc: first.hlc,
      data: { ...first.data, text: 'Written on the train, sent twice.' },
    })

    const body = (await push(ctx.tokens.student, [first]).expect(200)).body as protocol.PushResponse
    const repeat = (await push(ctx.tokens.student, [again]).expect(200))
      .body as protocol.PushResponse

    expect(body.results[0].status).toBe('accepted')
    expect(repeat.results[0].status).toBe('accepted')

    // One row, under the first id, carrying the later text; one journal entry,
    // because the stamp is the same and the index says so.
    expect(await storedAnswer(again.docId)).toBeNull()
    expect((await storedAnswer(first.docId)).text).toBe('Written on the train, sent twice.')
    expect(await journalFor(first.docId)).toHaveLength(1)
  })

  /* ------------------------------- T-S-22 ------------------------------- */

  it('T-S-22: the server fields of homework are dropped without a word', async () => {
    const change = answer({
      data: {
        enrollmentId: ctx.enrollment.id,
        lessonVersionId: ctx.mine.published.id,
        sectionId: SECTION_ID,
        text: 'Marked by myself, thank you',
        status: 'accepted',
        grade: 5,
        reviewedById: ctx.student.id,
        reviewedAt: new Date(NOW).toISOString(),
      },
    })

    const body = (await push(ctx.tokens.student, [change]).expect(200))
      .body as protocol.PushResponse

    expect(body.results[0].status).toBe('accepted')

    const stored = await storedAnswer(change.docId)

    expect(stored.status).toBe('pending')
    expect(stored.grade ?? null).toBeNull()
    expect(stored.reviewedById ?? null).toBeNull()
    expect(stored.text).toBe('Marked by myself, thank you')
  })

  /* ------------------------------- T-S-23 ------------------------------- */

  it('T-S-23: content collections take nothing from a device', async () => {
    const changes = [
      { ...answer({ outboxId: 1 }), collection: 'courses' as const },
      { ...answer({ outboxId: 2 }), collection: 'lessons' as const },
      { ...answer({ outboxId: 3 }), collection: 'lesson_versions' as const },
    ]

    const body = (await push(ctx.tokens.student, changes).expect(200)).body as protocol.PushResponse

    expect(body.results.map((r) => (r as protocol.PushRejected).reason)).toEqual([
      'readOnlyCollection',
      'readOnlyCollection',
      'readOnlyCollection',
    ])
  })

  /* ------------------------------- T-S-24 ------------------------------- */

  it('T-S-24: a row addressed to another student enrolment is refused', async () => {
    const change = answer({
      data: {
        enrollmentId: ctx.strangerEnrollment.id,
        lessonVersionId: ctx.theirs.published.id,
        sectionId: SECTION_ID,
        text: 'Not mine to write',
      },
    })

    const body = (await push(ctx.tokens.student, [change]).expect(200))
      .body as protocol.PushResponse

    expect((body.results[0] as protocol.PushRejected).reason).toBe('notYourEnrollment')
  })

  /* ------------------------------- T-S-25 ------------------------------- */

  it('T-S-25: a place that was never granted refuses the row, not the batch', async () => {
    const change = answer({
      data: {
        enrollmentId: ctx.pendingEnrollment.id,
        lessonVersionId: ctx.theirs.published.id,
        sectionId: SECTION_ID,
        text: 'Waiting to be let in',
      },
    })

    const body = (await push(ctx.tokens.pending, [change, progress()]).expect(200))
      .body as protocol.PushResponse

    expect((body.results[0] as protocol.PushRejected).reason).toBe('enrollmentRevoked')
    expect(body.results).toHaveLength(2)
  })

  /* ------------------------------- T-S-26 ------------------------------- */

  it('T-S-26: an unpublished version is not something to answer', async () => {
    const change = answer({
      data: {
        enrollmentId: ctx.enrollment.id,
        lessonVersionId: ctx.mine.draft.id,
        sectionId: SECTION_ID,
        text: 'Read it over the editor shoulder',
      },
    })

    const body = (await push(ctx.tokens.student, [change]).expect(200))
      .body as protocol.PushResponse

    expect((body.results[0] as protocol.PushRejected).reason).toBe('unknownLessonVersion')
  })

  /* ------------------------------- T-S-27 ------------------------------- */

  it('T-S-27: accepted work is frozen', async () => {
    const homework = app.get(HomeworkService)
    const submitted = await homework.submit({
      enrollment: ctx.enrollment,
      version: ctx.mine.published,
      sectionId: SECTION_ID,
      text: 'The answer as handed in',
    })

    await homework.review(submitted, { status: 'accepted', grade: 5, reviewerId: ctx.student.id })

    const change = answer({
      docId: submitted.id,
      data: { text: 'Second thoughts' },
    })

    const body = (await push(ctx.tokens.student, [change]).expect(200))
      .body as protocol.PushResponse

    expect((body.results[0] as protocol.PushRejected).reason).toBe('alreadyAccepted')
    expect((await storedAnswer(submitted.id)).text).toBe('The answer as handed in')
  })

  /* --------------------------- T-S-28, AC-10p --------------------------- */

  it('T-S-28: an answer written offline against a superseded version is flagged, not refused', async () => {
    // Published while the device was away; publishing does not unpublish v1.
    await app.get(LessonVersionsService).publish(ctx.mine.lesson.id, ctx.mine.draft.id)

    const change = answer()
    const body = (await push(ctx.tokens.student, [change]).expect(200))
      .body as protocol.PushResponse

    expect(body.results[0].status).toBe('accepted')

    const stored = await storedAnswer(change.docId)

    expect(stored.lessonVersionId).toBe(ctx.mine.published.id)
    expect(stored.answeredSupersededVersion).toBe(true)
  })

  /* ------------------------------- T-S-29 ------------------------------- */

  it('T-S-29: two edits of one document land in the order they were sent', async () => {
    const docId = uuid()
    const changes = [
      answer({ outboxId: 1, docId, hlc: hlc(NOW - 60_000), data: bodyOf(ctx, 'First') }),
      answer({ outboxId: 2, docId, hlc: hlc(NOW - 50_000), data: bodyOf(ctx, 'Second') }),
    ]

    const body = (await push(ctx.tokens.student, changes).expect(200)).body as protocol.PushResponse

    expect(body.results.map((r) => r.status)).toEqual(['accepted', 'accepted'])
    expect((await storedAnswer(docId)).text).toBe('Second')
  })

  /* ------------------------------- T-S-30 ------------------------------- */

  it('T-S-30: a row over the ceiling is refused, and its neighbour is applied', async () => {
    const huge = answer({
      outboxId: 1,
      data: { ...bodyOf(ctx, 'x'.repeat(protocol.SYNC_MAX_CHANGE_BYTES + 1)) },
    })

    const body = (await push(ctx.tokens.student, [huge, progress({ outboxId: 2 })]).expect(200))
      .body as protocol.PushResponse

    expect((body.results[0] as protocol.PushRejected).reason).toBe('payloadTooLarge')
    expect(body.results[1].status).toBe('accepted')
  })

  /* ------------------------------- T-S-31 ------------------------------- */

  it('T-S-31: an empty batch is an empty answer, not an error', async () => {
    const body = (await push(ctx.tokens.student, []).expect(200)).body as protocol.PushResponse

    expect(body.results).toEqual([])
    expect(body.journaledOutboxId).toBe(0)
  })

  /* --------------------------- T-S-38, T-S-39 --------------------------- */

  describe('the clock skew ceiling', () => {
    it('T-S-38: restamps a row from a device whose clock is a year fast', async () => {
      const ahead = answer({ hlc: hlc(NOW + 365 * 24 * 3600 * 1000) })

      const body = (await push(ctx.tokens.student, [ahead]).expect(200))
        .body as protocol.PushResponse
      const result = body.results[0] as protocol.PushAccepted

      expect(result.status).toBe('accepted')
      expect(result.restamped).toBe(true)
      expect(isServerDeviceId(domain.parseHlc(result.serverHlc).deviceId)).toBe(true)
      expect(domain.parseHlc(result.serverHlc).physical).toBeLessThanOrEqual(NOW)

      // The work is kept, and the journal is not anchored in the future: no
      // other device can pick the broken clock up through `latestServerHlc`.
      expect(await storedAnswer(ahead.docId)).not.toBeNull()

      const [highest] = await ds.query('SELECT max(hlc) AS hlc FROM sync_journal')
      expect(domain.parseHlc(highest.hlc).physical).toBeLessThanOrEqual(NOW)
    })

    it('T-S-39: keeps a stamp sitting exactly on the boundary', async () => {
      const edge = answer({ hlc: hlc(NOW + protocol.SYNC_CLOCK_SKEW_TOLERANCE_MS) })

      const body = (await push(ctx.tokens.student, [edge]).expect(200))
        .body as protocol.PushResponse
      const result = body.results[0] as protocol.PushAccepted

      expect(result.restamped).toBe(false)
      expect(result.serverHlc).toBe(edge.hlc)
    })
  })

  /* ------------------------------- T-S-42 ------------------------------- */

  describe('T-S-42: two devices sharing one id cannot swallow a write', () => {
    it('answers a genuine repeat from the journal', async () => {
      const change = answer()

      const first = (await push(ctx.tokens.student, [change]).expect(200))
        .body as protocol.PushResponse
      const again = (await push(ctx.tokens.student, [change]).expect(200))
        .body as protocol.PushResponse

      expect((again.results[0] as protocol.PushAccepted).restamped).toBe(false)
      expect((again.results[0] as protocol.PushAccepted).serverHlc).toBe(
        (first.results[0] as protocol.PushAccepted).serverHlc,
      )
      expect(await journalFor(change.docId)).toHaveLength(1)
    })

    it('restamps the same stamp carrying a different body, and keeps both records', async () => {
      const change = answer()

      await push(ctx.tokens.student, [change]).expect(200)

      const collision = { ...change, data: bodyOf(ctx, 'Written on the other phone') }

      const body = (await push(ctx.tokens.student, [collision]).expect(200))
        .body as protocol.PushResponse
      const result = body.results[0] as protocol.PushAccepted

      expect(result.status).toBe('accepted')
      expect(result.restamped).toBe(true)
      expect(result.serverHlc).not.toBe(change.hlc)

      const rows = await journalFor(change.docId)

      expect(rows).toHaveLength(2)
      expect((await storedAnswer(change.docId)).text).toBe('Written on the other phone')
    })
  })

  /**
   * A row is answered under the id the server actually wrote it to.
   *
   * The table's key is `(enrolment, version, section)`, so the second device
   * writes onto the row the first created — which is right, and is how the HLC
   * gets to decide the text. What was wrong was the answer: both devices were
   * told `accepted` on the id *they* had sent, so the second kept a local row
   * the server never stored, carried by no pull and removed by no tombstone,
   * while the winning row arrived beside it as a second answer to one section.
   */
  describe('one section handed in from two devices under two local ids', () => {
    it('answers the second with the id of the row it landed in', async () => {
      const first = answer({ outboxId: 1, data: bodyOf(ctx, 'From the phone') })
      const second = answer({
        outboxId: 2,
        hlc: hlc(NOW - 50_000, 0, 'device-b21e7f05'),
        data: bodyOf(ctx, 'From the tablet'),
      })

      const one = (await push(ctx.tokens.student, [first]).expect(200))
        .body as protocol.PushResponse
      const two = (await push(ctx.tokens.student, [second], 'device-b21e7f05').expect(200))
        .body as protocol.PushResponse

      const winner = one.results[0] as protocol.PushAccepted
      const loser = two.results[0] as protocol.PushAccepted

      expect(loser.status).toBe('accepted')

      // The answer still names the row that was sent, so the device can match
      // it to its outbox — and now also names the row the server holds.
      expect(loser.docId).toBe(second.docId)
      expect(loser.serverDocId).toBe(first.docId)

      // The id the first device sent is the one the table kept, and it was
      // answered without a rename because none happened.
      expect(winner.serverDocId).toBeUndefined()
      expect(await storedAnswer(second.docId)).toBeNull()
      expect((await storedAnswer(first.docId)).text).toBe('From the tablet')
    })
  })

  /* --------------------------- progress upward --------------------------- */

  it('stores the block state a device reports', async () => {
    const change = progress({ outboxId: 5 })

    const body = (await push(ctx.tokens.student, [change]).expect(200))
      .body as protocol.PushResponse

    expect(body.results[0].status).toBe('accepted')
    expect((await storedProgress(change.docId)).state).toEqual({
      type: 'text',
      read: true,
    })
  })

  it('refuses a body that is not a block state', async () => {
    const change = progress({ data: { state: { type: 'telepathy' } } })

    const body = (await push(ctx.tokens.student, [change]).expect(200))
      .body as protocol.PushResponse

    expect((body.results[0] as protocol.PushRejected).reason).toBe('malformed')
  })

  it('refuses a batch of more rows than the contract allows', async () => {
    const changes = Array.from({ length: protocol.SYNC_MAX_PUSH_CHANGES + 1 }, (_, index) =>
      answer({ outboxId: index }),
    )

    const response = await push(ctx.tokens.student, changes).expect(400)

    expect(response.body.code).toBe('batchTooLarge')
  })

  it('refuses a caller with no token', () =>
    request(app.getHttpServer())
      .post(routes.push())
      .send({ deviceId: DEVICE, changes: [] })
      .expect(401))
})

const bodyOf = (ctx: SyncContext, text: string): domain.SyncPayload => ({
  enrollmentId: ctx.enrollment.id,
  lessonVersionId: ctx.mine.published.id,
  sectionId: SECTION_ID,
  text,
})
