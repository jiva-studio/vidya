import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './myProgressContext'

describe('/edu/progress without an enrollment', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterAll(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.progress

  const find = (token: string, query = '') =>
    request(app.getHttpServer())
      .get(`${routes.find()}${query}`)
      .auth(token, { type: 'bearer' })

  const items = (response: request.Response) =>
    (response.body as protocol.GetBlockStatesResponse).items

  it('returns 401 without a token', () => {
    return request(app.getHttpServer()).get(routes.find()).expect(401)
  })

  it('answers across every place the caller holds when none is named', async () => {
    // The id used to be required, which a client on its first run cannot supply.
    const response = await find(ctx.tokens.student).expect(200)

    expect(items(response).map((s) => s.enrollmentId).sort()).toEqual(
      [ctx.firstEnrollmentId, ctx.secondEnrollmentId].sort(),
    )
  })

  it('does not mix in the progress of another student on the same course', async () => {
    const response = await find(ctx.tokens.otherStudent).expect(200)

    expect(items(response)).toHaveLength(1)
    expect(items(response)[0].enrollmentId).not.toBe(ctx.firstEnrollmentId)
  })

  it('still narrows to one lesson version', async () => {
    const response = await find(ctx.tokens.student, `?lessonVersionId=${ctx.secondVersionId}`)

    expect(items(response)).toHaveLength(1)
    expect(items(response)[0].enrollmentId).toBe(ctx.secondEnrollmentId)
  })

  it('still answers about one named place', async () => {
    const response = await find(
      ctx.tokens.student,
      `?enrollmentId=${ctx.firstEnrollmentId}`,
    ).expect(200)

    expect(items(response)).toHaveLength(1)
    expect(items(response)[0].enrollmentId).toBe(ctx.firstEnrollmentId)
  })

  it('dates progress as a UTC instant', async () => {
    const response = await find(ctx.tokens.student).expect(200)

    expect(items(response)[0].updatedAt).toMatch(/Z$/)
  })
})
