import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext, EXPLANATION, RIGHT_ANSWER } from './publishedContext'

/**
 * Walks anything the server sent and collects every path where the forbidden
 * key appears.
 *
 * The walk is recursive rather than reaching into `sections[i].blocks[j]` on
 * purpose: the point is that the key is absent from the whole document, at any
 * depth, including shapes this test was not written against.
 */
const pathsOf = (key: string, value: unknown, path = '$'): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => pathsOf(key, item, `${path}[${index}]`))
  }

  if (value === null || typeof value !== 'object') return []

  return Object.entries(value).flatMap(([name, nested]) =>
    name === key ? [`${path}.${name}`] : pathsOf(key, nested, `${path}.${name}`),
  )
}

describe('/edu/lessons/:lessonId/versions/published', () => {
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

  const get = (lessonId: string, token: string) =>
    request(app.getHttpServer()).get(routes.published(lessonId)).auth(token, { type: 'bearer' })

  /* -------------------------------------------------------------------------- */
  /*                                  The route                                 */
  /* -------------------------------------------------------------------------- */

  it('returns 401 without a token', () => {
    return request(app.getHttpServer()).get(routes.published(ctx.lessonId)).expect(401)
  })

  it('answers a student with the published version and its content in one request', async () => {
    const response = await get(ctx.lessonId, ctx.tokens.student).expect(200)
    const body = response.body as protocol.GetPublishedLessonVersionResponse

    expect(body.id).toBe(ctx.publishedVersionId)
    expect(body.status).toBe('published')
    expect(body.content.sections[0].title).toBe('Introduction')
  })

  it('never answers with a draft, even a newer one', async () => {
    const response = await get(ctx.lessonId, ctx.tokens.student).expect(200)
    const body = response.body as protocol.GetPublishedLessonVersionResponse

    expect(body.version).toBe(1)
    expect(body.content.sections[0].title).not.toBe('Rewritten, not published')
  })

  it('reports a lesson with nothing published as not found', () => {
    return get(ctx.unpublishedLessonId, ctx.tokens.student).expect(404)
  })

  it('dates the publication as a UTC instant', async () => {
    const response = await get(ctx.lessonId, ctx.tokens.student).expect(200)
    const body = response.body as protocol.GetPublishedLessonVersionResponse

    expect(body.publishedAt).toMatch(/Z$/)
  })

  /* -------------------------------------------------------------------------- */
  /*                                   Access                                   */
  /* -------------------------------------------------------------------------- */

  it('serves staff who hold lessons:read without any enrollment', () => {
    return get(ctx.lessonId, ctx.tokens.teacher).expect(200)
  })

  it('refuses a caller with no place on the course', () => {
    return get(ctx.lessonId, ctx.tokens.stranger).expect(403)
  })

  it('refuses a request that was never accepted', () => {
    // A pending request is not a place, so it grants no reading either.
    return get(ctx.lessonId, ctx.tokens.pendingStudent).expect(403)
  })

  /* -------------------------------------------------------------------------- */
  /*: quiz answer keys stay on the server */
  /* -------------------------------------------------------------------------- */

  it('withholds rightAnswer from every quiz block in a response to a student', async () => {
    const response = await get(ctx.lessonId, ctx.tokens.student).expect(200)

    // Content is downloaded onto the device whole: a key that reaches SQLite
    // there cannot be recalled by any later server change.
    expect(pathsOf('rightAnswer', response.body)).toEqual([])
    expect(JSON.stringify(response.body)).not.toContain('rightAnswer')
  })

  it('withholds the explanation as well, because prose gives the answer away too', async () => {
    const response = await get(ctx.lessonId, ctx.tokens.student).expect(200)

    expect(pathsOf('explanation', response.body)).toEqual([])
    expect(JSON.stringify(response.body)).not.toContain(EXPLANATION)
  })

  it('withholds it from staff on this route too, so one client cannot leak it', async () => {
    const response = await get(ctx.lessonId, ctx.tokens.teacher).expect(200)

    expect(pathsOf('rightAnswer', response.body)).toEqual([])
    expect(pathsOf('explanation', response.body)).toEqual([])
  })

  it('still serves the question and the options, so the quiz remains answerable', async () => {
    const response = await get(ctx.lessonId, ctx.tokens.student).expect(200)
    const body = response.body as protocol.GetPublishedLessonVersionResponse
    const quiz = body.content.sections[0].blocks[1] as protocol.StudentQuizBlock

    expect(quiz.type).toBe('quiz')
    expect(quiz.question).toContain('Bhagavad-gita')
    expect(quiz.answers).toHaveLength(4)
  })

  it('proves the test would see the key if it were there', () => {
    // A guard on the guard: the walk above finds nothing only because nothing
    // is there, not because it looks in the wrong place.
    const withKey = {
      content: {
        sections: [{ blocks: [{ rightAnswer: RIGHT_ANSWER, explanation: EXPLANATION }] }],
      },
    }

    expect(pathsOf('rightAnswer', withKey)).toEqual(['$.content.sections[0].blocks[0].rightAnswer'])
    expect(pathsOf('explanation', withKey)).toEqual(['$.content.sections[0].blocks[0].explanation'])
  })

  /* -------------------------------------------------------------------------- */
  /*                             The editor's route                             */
  /* -------------------------------------------------------------------------- */

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
