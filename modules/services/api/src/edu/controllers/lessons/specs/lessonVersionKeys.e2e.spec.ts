import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext, EXPLANATION, RIGHT_ANSWER } from './keysContext'

/**
 * The editor's side of the answer key.
 *
 * What a student receives is withheld by the journal projection and proved on
 * the sync path; what is proved here is that the same content still carries the
 * key on the route the editor reads, so the withholding is a projection rather
 * than a hole in the stored lesson.
 */
describe('/edu/lessons/:lessonId/versions/:versionId', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.lessons.versions

  it('leaves the key on the version route the editor reads', async () => {
    // The editor has to see the key to author it; only the student projection drops it.
    const response = await request(app.getHttpServer())
      .get(routes.get(ctx.lessonId, ctx.publishedVersionId))
      .auth(ctx.tokens.teacher, { type: 'bearer' })
      .expect(200)

    const body = response.body as protocol.GetLessonVersionResponse
    const quiz = body.content.sections[0].blocks[1] as protocol.QuizBlock

    expect(quiz.rightAnswer).toBe(RIGHT_ANSWER)
    expect(quiz.explanation).toBe(EXPLANATION)
  })
})
