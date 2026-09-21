import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import {
  CoursesService,
  EnrollmentsService,
  LessonsService,
  LessonVersionsService,
  UsersService,
} from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { CLOCK } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import { BlockState, Homework } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { randomUUID } from 'crypto'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import {
  BLOCK_ID,
  createSyncContext,
  EXPLANATION,
  QUIZ_BLOCK_ID,
  RIGHT_ANSWER,
  SECTION_ID,
  SyncContext,
} from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

/** The student's other device, so a row this suite pushed is not filtered out of its own pull. */
const OTHER_DEVICE = 'device-2b7c9e01'

/** A fixed moment, so every stamp in the suite sits inside the skew ceiling. */
const NOW = Date.UTC(2026, 8, 18, 0, 0, 0)

/** A lesson whose one section the machine marks, so a share of right answers exists. */
const AUTO_SECTION_ID = domain.asId<domain.SectionId>('44444444-4444-4444-8444-444444444444')
const AUTO_QUIZ_ONE = domain.asId<domain.BlockId>('55555555-5555-4555-8555-555555555555')
const AUTO_QUIZ_TWO = domain.asId<domain.BlockId>('66666666-6666-4666-8666-666666666666')

const AUTO_RIGHT_ONE = 1
const AUTO_RIGHT_TWO = 0

const hlc = (physical: number, counter = 0, device = DEVICE): string =>
  `${String(physical).padStart(15, '0')}:${String(counter).padStart(5, '0')}:${device}`

/** A section the machine marks, with two quizzes so a half is expressible. */
const autoContent = (): domain.LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [
    {
      id: AUTO_SECTION_ID,
      title: 'Self-marked',
      assessment: 'auto',
      blocks: [
        {
          id: AUTO_QUIZ_ONE,
          type: 'quiz',
          question: 'Who drives the chariot?',
          answers: ['Arjuna', 'Krishna'],
          rightAnswer: AUTO_RIGHT_ONE,
          explanation: 'Krishna takes the reins and Arjuna takes the bow.',
        },
        {
          id: AUTO_QUIZ_TWO,
          type: 'quiz',
          question: 'On which field?',
          answers: ['Kurukshetra', 'Vrindavan'],
          rightAnswer: AUTO_RIGHT_TWO,
          explanation: 'Kurukshetra, named in the opening line.',
        },
      ],
    },
  ],
})

/** What the server says about an answer, once it has said it. */
type Marked = { correct?: boolean; explanation?: string } | null | undefined

/**
 * The server marks a quiz answer, and a section it marks alone marks itself.
 *
 * The key never leaves the server, so nothing below it can decide whether an
 * answer is right; the answer travels up and the verdict travels back. Two
 * properties carry the weight: the explanation reaches the student with the
 * verdict and never with the lesson, and a block that has been marked cannot be
 * answered again — an unlimited retry hands out the key one wrong answer at a
 * time.
 */
describe('-sync: an answer the server marks', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: SyncContext

  /** The student's place on the course whose section marks itself. */
  let autoEnrollment: domain.EnrollmentId
  let autoVersion: domain.LessonVersionId

  /** Someone who may read the queue of work waiting for a person. */
  let reviewerToken: string

  beforeEach(async () => {
    app = await createTestingApp([{ provide: CLOCK, useValue: { nowMs: () => NOW } }])
    ds = app.get(DataSource)
    ctx = await createSyncContext(app)

    const course = await app.get(CoursesService).create({
      name: 'Gita, marked by machine',
      learningType: 'individual',
      schoolId: ctx.schoolId,
    })

    const lesson = await app.get(LessonsService).create({
      courseId: course.id,
      schoolId: ctx.schoolId,
      lessonNumber: 1,
      title: 'Self-marked',
    })

    const version = await app.get(LessonVersionsService).create({
      lessonId: lesson.id,
      version: 1,
      status: 'published',
      publishedAt: new Date(NOW),
      content: autoContent(),
    })

    autoVersion = version.id

    const place = await app.get(EnrollmentsService).create({
      courseId: course.id,
      studentId: ctx.student.id,
      schoolId: ctx.schoolId,
      status: 'accepted' as domain.EnrollmentStatus,
    })

    autoEnrollment = place.id

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

  const push = (changes: Partial<protocol.PushChange>[], token = ctx.tokens.student) =>
    request(app.getHttpServer())
      .post(routes.push())
      .auth(token, { type: 'bearer' })
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

  /** An answer to the quiz the shared fixture carries, in a section a person marks. */
  const answers = (overrides: Partial<protocol.PushChange> = {}): protocol.PushChange => ({
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
      blockId: QUIZ_BLOCK_ID,
      state: { type: 'quiz', answer: RIGHT_ANSWER },
      ...overrides.data,
    },
  })

  /** An answer to one of the quizzes in the section that marks itself. */
  const answersAuto = (
    blockId: domain.BlockId,
    answer: number,
    overrides: Partial<protocol.PushChange> = {},
  ): protocol.PushChange => ({
    outboxId: 1,
    collection: 'block_states',
    docId: randomUUID(),
    op: 'upsert',
    hlc: hlc(NOW - 60_000),
    baseHlc: null,
    ...overrides,
    data: {
      enrollmentId: autoEnrollment,
      lessonVersionId: autoVersion,
      blockId,
      state: { type: 'quiz', answer },
      ...overrides.data,
    },
  })

  /**
   * The verdict on the latest block state the pull hands back under `docId`.
   *
   * A pull with no cursors replays the whole journal, so the row appears once
   * per write it has seen; the last one is the state the device ends up in.
   */
  const verdictOf = async (docId: string): Promise<Marked> => {
    const body = await pull()
    const rows = body.changes.filter(
      (change) => change.collection === 'block_states' && change.docId === docId,
    )

    expect(rows.length).toBeGreaterThan(0)

    return rows[rows.length - 1].data.verdict as Marked
  }

  const storedState = (docId: string) =>
    ds.getRepository(BlockState).findOneBy({ id: docId as domain.BlockStateId })

  const workOn = (sectionId: domain.SectionId, enrollmentId: domain.EnrollmentId) =>
    ds.getRepository(Homework).findOneBy({ sectionId, enrollmentId })

  /* ----------------------------- marking an answer ---------------------------- */

  it('hands a verdict back for an answer that was pushed up', async () => {
    const change = answers()

    expect((await results([change]))[0].status).toBe('accepted')

    expect(await verdictOf(change.docId)).toBeTruthy()
  })

  it('marks a right answer correct', async () => {
    const change = answers()

    await results([change])

    expect(await verdictOf(change.docId)).toMatchObject({ correct: true })
  })

  it('marks a wrong answer as not correct', async () => {
    const change = answers({ data: { state: { type: 'quiz', answer: RIGHT_ANSWER - 1 } } })

    await results([change])

    expect(await verdictOf(change.docId)).toMatchObject({ correct: false })
  })

  it('sends the explanation with the verdict and never with the lesson', async () => {
    const change = answers()

    await results([change])

    expect(await verdictOf(change.docId)).toMatchObject({ explanation: EXPLANATION })

    const body = await pull()

    // The same prose, reaching the student a second way, would hand out the key
    // to every quiz in the lesson rather than to the one that was answered.
    const versions = body.changes.filter((candidate) => candidate.collection === 'lesson_versions')

    expect(versions.length).toBeGreaterThan(0)
    expect(JSON.stringify(versions)).not.toContain(EXPLANATION)
  })

  it('leaves a block that is not a quiz unmarked', async () => {
    const quiz = answers()
    const read = answers({
      outboxId: 2,
      hlc: hlc(NOW - 50_000),
      data: { blockId: BLOCK_ID, state: { type: 'text', read: true } },
    })

    await results([quiz, read])

    // The quiz is marked in the same batch, so an absent verdict on the text
    // block is the rule working rather than the marking never having run.
    expect(await verdictOf(quiz.docId)).toBeTruthy()
    expect(await verdictOf(read.docId)).toBeFalsy()
  })

  /* -------------------------------- one attempt ------------------------------- */

  it('refuses a second answer to a block that already carries a verdict', async () => {
    const first = answers()

    await results([first])

    const again = answers({
      outboxId: 2,
      docId: randomUUID(),
      hlc: hlc(NOW - 50_000),
      data: { state: { type: 'quiz', answer: RIGHT_ANSWER - 1 } },
    })

    expect((await results([again]))[0].status).toBe('rejected')
  })

  it('keeps the first answer and its verdict when a second is refused', async () => {
    const first = answers()

    await results([first])

    const before = await storedState(first.docId)

    await results([
      answers({
        outboxId: 2,
        docId: randomUUID(),
        hlc: hlc(NOW - 50_000),
        data: { state: { type: 'quiz', answer: RIGHT_ANSWER - 1 } },
      }),
    ])

    const after = await storedState(first.docId)

    expect(after.state).toEqual(before.state)
    expect(after.verdict).toEqual(before.verdict)
    expect(after.verdict).toMatchObject({ correct: true })
  })

  it('takes a resend of the answer it already has as the repeat it is', async () => {
    const change = answers()

    expect((await results([change]))[0].status).toBe('accepted')

    // The same stamp and the same body: an engine that lost the answer to a
    // broken connection, not a student answering twice.
    expect((await results([change]))[0].status).toBe('accepted')

    expect((await storedState(change.docId)).state).toEqual({
      type: 'quiz',
      answer: RIGHT_ANSWER,
    })

    // The verdict of the first attempt survives the resend rather than the
    // resend being treated as an attempt of its own.
    expect(await verdictOf(change.docId)).toMatchObject({ correct: true })
  })

  it('ignores a verdict a device tries to write for itself', async () => {
    const change = answers({
      data: {
        state: { type: 'quiz', answer: RIGHT_ANSWER - 1 },
        verdict: { correct: true, explanation: 'I marked this myself.' },
      },
    })

    await results([change])

    // The answer is wrong, so the only way `correct` could be true is the
    // device having written the field the ownership table gives the server.
    const marked = await verdictOf(change.docId)

    expect(marked).toMatchObject({ correct: false })
    expect(marked.explanation ?? '').not.toContain('myself')
  })

  /* --------------------------- a section that marks itself -------------------- */

  it('marks the work of a fully answered auto section with the share of right answers', async () => {
    await results([
      answersAuto(AUTO_QUIZ_ONE, AUTO_RIGHT_ONE),
      answersAuto(AUTO_QUIZ_TWO, AUTO_RIGHT_TWO, { outboxId: 2, hlc: hlc(NOW - 50_000) }),
    ])

    const work = await workOn(AUTO_SECTION_ID, autoEnrollment)

    expect(work).toBeTruthy()
    expect(work.grade).toBe(100)
    expect(work.status).toBe('accepted')
  })

  it('grades a half-right auto section at fifty percent', async () => {
    await results([
      answersAuto(AUTO_QUIZ_ONE, AUTO_RIGHT_ONE),
      answersAuto(AUTO_QUIZ_TWO, AUTO_RIGHT_TWO + 1, { outboxId: 2, hlc: hlc(NOW - 50_000) }),
    ])

    const work = await workOn(AUTO_SECTION_ID, autoEnrollment)

    expect(work.grade).toBe(50)
    expect(work.status).toBe('accepted')
  })

  it('keeps work the machine marked out of the queue a person reads', async () => {
    await results([
      answersAuto(AUTO_QUIZ_ONE, AUTO_RIGHT_ONE),
      answersAuto(AUTO_QUIZ_TWO, AUTO_RIGHT_TWO, { outboxId: 2, hlc: hlc(NOW - 50_000) }),
    ])

    const queue = await request(app.getHttpServer())
      .get(`${protocol.Routes().edu.homework.find()}?status=pending`)
      .auth(reviewerToken, { type: 'bearer' })
      .expect(200)

    const sections = (queue.body as protocol.GetHomeworkListResponse).items.map(
      (item) => item.sectionId,
    )

    expect(sections).not.toContain(AUTO_SECTION_ID)

    // And the work exists, so the absence above is a decision rather than an
    // empty table.
    expect(await workOn(AUTO_SECTION_ID, autoEnrollment)).toBeTruthy()
  })

  it('does not mark an auto section the student has only half answered', async () => {
    const change = answersAuto(AUTO_QUIZ_ONE, AUTO_RIGHT_ONE)

    await results([change])

    // The answer was marked, so the section is unmarked because a quiz of it is
    // still unanswered and not because nothing ran at all.
    expect(await verdictOf(change.docId)).toMatchObject({ correct: true })

    const work = await workOn(AUTO_SECTION_ID, autoEnrollment)

    expect(work?.status ?? 'open').not.toBe('accepted')
    expect(work?.grade ?? null).toBeNull()
  })

  it('marks a quiz in a section a person owns without touching that section work', async () => {
    const change = answers()

    await results([change])

    expect(await verdictOf(change.docId)).toMatchObject({ correct: true })

    // The section is marked `teacher`: the verdict is self-assessment, and the
    // homework of that section stays whatever the student and reviewer made it.
    expect(await workOn(SECTION_ID, ctx.enrollment.id)).toBeNull()
  })
})
