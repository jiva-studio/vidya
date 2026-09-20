import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/progress', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.progress

  const read = { type: 'text' as const, read: true }

  /* -------------------------------------------------------------------------- */
  /*                                   Saving                                   */
  /* -------------------------------------------------------------------------- */

  it('returns 401 without a token', () => {
    return request(app.getHttpServer()).post(routes.save()).send({}).expect(401)
  })

  it('records how far a student got through a block', async () => {
    const response = await request(app.getHttpServer())
      .post(routes.save())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .send({ lessonVersionId: ctx.publishedVersionId, blockId: ctx.blockId, state: read })
      .expect(201)

    const body = response.body as protocol.SaveBlockStateResponse

    expect(body.enrollmentId).toBe(ctx.enrollmentId)
    expect(body.blockId).toBe(ctx.blockId)
    expect(body.state).toEqual(read)
  })

  it('replaces the previous state instead of adding a second row', async () => {
    // The offline client replays its outbox, so the same push arrives twice.
    const send = (state: protocol.LessonBlockState) =>
      request(app.getHttpServer())
        .post(routes.save())
        .auth(ctx.tokens.student, { type: 'bearer' })
        .send({ lessonVersionId: ctx.publishedVersionId, blockId: ctx.blockId, state })
        .expect(201)

    const first = await send(read)
    const second = await send(read)

    expect((second.body as protocol.SaveBlockStateResponse).id).toBe(
      (first.body as protocol.SaveBlockStateResponse).id,
    )

    const list = await request(app.getHttpServer())
      .get(`${routes.find()}?enrollmentId=${ctx.enrollmentId}`)
      .auth(ctx.tokens.student, { type: 'bearer' })
      .expect(200)

    expect((list.body as protocol.GetBlockStatesResponse).items).toHaveLength(1)
  })

  it('refuses a student who was never enrolled', () => {
    return request(app.getHttpServer())
      .post(routes.save())
      .auth(ctx.tokens.stranger, { type: 'bearer' })
      .send({ lessonVersionId: ctx.publishedVersionId, blockId: ctx.blockId, state: read })
      .expect(403)
  })

  it('refuses a student whose request is still pending', () => {
    // Access comes from being accepted, not from having asked.
    return request(app.getHttpServer())
      .post(routes.save())
      .auth(ctx.tokens.pendingStudent, { type: 'bearer' })
      .send({ lessonVersionId: ctx.publishedVersionId, blockId: ctx.blockId, state: read })
      .expect(403)
  })

  /* -------------------------------------------------------------------------- */
  /*                                   Reading                                  */
  /* -------------------------------------------------------------------------- */

  const saveOne = () =>
    request(app.getHttpServer())
      .post(routes.save())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .send({ lessonVersionId: ctx.publishedVersionId, blockId: ctx.blockId, state: read })
      .expect(201)

  it('lets a student read their own progress', async () => {
    await saveOne()

    const response = await request(app.getHttpServer())
      .get(`${routes.find()}?enrollmentId=${ctx.enrollmentId}`)
      .auth(ctx.tokens.student, { type: 'bearer' })
      .expect(200)

    expect((response.body as protocol.GetBlockStatesResponse).items).toHaveLength(1)
  })

  it('lets a teacher read a student’s progress', async () => {
    await saveOne()

    const response = await request(app.getHttpServer())
      .get(`${routes.find()}?enrollmentId=${ctx.enrollmentId}`)
      .auth(ctx.tokens.teacher, { type: 'bearer' })
      .expect(200)

    expect((response.body as protocol.GetBlockStatesResponse).items).toHaveLength(1)
  })

  it('refuses a stranger reading someone else’s progress', async () => {
    await saveOne()

    return request(app.getHttpServer())
      .get(`${routes.find()}?enrollmentId=${ctx.enrollmentId}`)
      .auth(ctx.tokens.stranger, { type: 'bearer' })
      .expect(403)
  })

  it('answers 404 for an enrollment that does not exist', () => {
    return request(app.getHttpServer())
      .get(`${routes.find()}?enrollmentId=6eb216f2-543d-4f15-88f5-f325a1bdcafd`)
      .auth(ctx.tokens.teacher, { type: 'bearer' })
      .expect(404)
  })

  it('narrows progress to one lesson version', async () => {
    await saveOne()

    const response = await request(app.getHttpServer())
      .get(
        `${routes.find()}?enrollmentId=${ctx.enrollmentId}&lessonVersionId=${ctx.publishedVersionId}`,
      )
      .auth(ctx.tokens.student, { type: 'bearer' })
      .expect(200)

    expect((response.body as protocol.GetBlockStatesResponse).items).toHaveLength(1)
  })
})
