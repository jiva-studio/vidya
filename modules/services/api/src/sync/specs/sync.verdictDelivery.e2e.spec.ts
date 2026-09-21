import { INestApplication } from '@nestjs/common'
import {
  CoursesService,
  EnrollmentsService,
  LessonsService,
  LessonVersionsService,
} from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { CLOCK } from '@vidya/api/sync'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import { randomUUID } from 'crypto'
import * as request from 'supertest'

import { createSyncContext, SyncContext } from './context'

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

const NOW = Date.UTC(2026, 8, 18, 0, 0, 0)

const SECTION_ID = domain.asId<domain.SectionId>('7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a')
const QUIZ_ID = domain.asId<domain.BlockId>('8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8b8b')

const hlc = (physical: number): string => `${String(physical).padStart(15, '0')}:00000:${DEVICE}`

const content = (): domain.LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [
    {
      id: SECTION_ID,
      title: 'Self-marked',
      assessment: 'auto',
      blocks: [
        {
          id: QUIZ_ID,
          type: 'quiz',
          question: 'Who drives the chariot?',
          answers: ['Arjuna', 'Krishna'],
          rightAnswer: 1,
        },
      ],
    },
  ],
})

/**
 * The device that answered is the one the verdict is owed to.
 *
 * A pull hands a device every row but its own, so a decision journalled under
 * the pushing device would reach every other device of that student and never
 * the one waiting for it — the one case the feature exists for.
 */
describe('-sync: a verdict reaches the device that asked for it', () => {
  let app: INestApplication
  let ctx: SyncContext
  let enrollmentId: domain.EnrollmentId
  let versionId: domain.LessonVersionId

  beforeEach(async () => {
    app = await createTestingApp([{ provide: CLOCK, useValue: { nowMs: () => NOW } }])
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
      content: content(),
    })

    versionId = version.id

    const place = await app.get(EnrollmentsService).create({
      courseId: course.id,
      studentId: ctx.student.id,
      schoolId: ctx.schoolId,
      status: 'accepted' as domain.EnrollmentStatus,
    })

    enrollmentId = place.id
  })

  afterEach(async () => {
    await app.close()
  })

  const answer = async (): Promise<string> => {
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
              enrollmentId,
              lessonVersionId: versionId,
              blockId: QUIZ_ID,
              state: { type: 'quiz', answer: 1 },
            },
          },
        ],
      })
      .expect(200)

    return docId
  }

  const pulledByTheSameDevice = async (): Promise<protocol.SyncChange[]> =>
    (
      (
        await request(app.getHttpServer())
          .post(routes.pull())
          .auth(ctx.tokens.student, { type: 'bearer' })
          .send({ deviceId: DEVICE, cursors: {} })
          .expect(200)
      ).body as protocol.PullResponse
    ).changes

  it('hands the verdict to the device whose answer earned it', async () => {
    const docId = await answer()

    const marked = (await pulledByTheSameDevice()).filter(
      (change) => change.collection === 'block_states' && change.docId === docId,
    )

    expect(marked).toHaveLength(1)
    expect(marked[0].data.verdict).toMatchObject({ correct: true })
  })

  it('hands the work a section marked itself to that device too', async () => {
    await answer()

    const work = (await pulledByTheSameDevice()).filter(
      (change) => change.collection === 'homework',
    )

    expect(work).toHaveLength(1)
    expect(work[0].data).toMatchObject({ status: 'accepted', grade: 100 })
  })
})
