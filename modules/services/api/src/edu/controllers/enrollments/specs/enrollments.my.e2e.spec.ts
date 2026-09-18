import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/enrollments/my', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterAll(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.enrollments

  const enroll = (courseId: string, token: string) =>
    request(app.getHttpServer())
      .post(routes.create())
      .auth(token, { type: 'bearer' })
      .send({ courseId })
      .expect(201)

  const my = (token: string, query = '') =>
    request(app.getHttpServer()).get(`${routes.my()}${query}`).auth(token, { type: 'bearer' })

  const items = (response: request.Response) =>
    (response.body as protocol.GetEnrollmentsResponse).items

  it('returns 401 without a token', () => {
    return request(app.getHttpServer()).get(routes.my()).expect(401)
  })

  it('lists every place the caller holds, without being told an id', async () => {
    // A client starting up knows no enrollment id yet, which is what made
    // progress and homework unreachable on a first run.
    await enroll(ctx.courseId, ctx.tokens.student)
    await enroll(ctx.otherCourseId, ctx.tokens.student)

    const response = await my(ctx.tokens.student).expect(200)

    expect(items(response)).toHaveLength(2)
    expect(
      items(response)
        .map((e) => e.courseId)
        .sort(),
    ).toEqual([ctx.courseId, ctx.otherCourseId].sort())
  })

  it('does not show one student the places of another', async () => {
    await enroll(ctx.courseId, ctx.tokens.student)
    await enroll(ctx.courseId, ctx.tokens.otherStudent)

    const response = await my(ctx.tokens.otherStudent).expect(200)

    expect(items(response)).toHaveLength(1)
  })

  it('answers about the caller even when the caller is staff', async () => {
    // The list route widens for staff; this one never does, so a teacher who
    // also studies gets their own places rather than the school's.
    await enroll(ctx.courseId, ctx.tokens.student)

    const mine = await my(ctx.tokens.observer).expect(200)

    const all = await request(app.getHttpServer())
      .get(routes.find())
      .auth(ctx.tokens.observer, { type: 'bearer' })
      .expect(200)

    expect(items(mine)).toHaveLength(0)
    expect(items(all)).toHaveLength(1)
  })

  it('narrows to a status when asked', async () => {
    await enroll(ctx.courseId, ctx.tokens.student)

    const pending = await my(ctx.tokens.student, '?status=pending').expect(200)
    const accepted = await my(ctx.tokens.student, '?status=accepted').expect(200)

    expect(items(pending)).toHaveLength(1)
    expect(items(accepted)).toHaveLength(0)
  })

  it('dates a place as a UTC instant', async () => {
    await enroll(ctx.courseId, ctx.tokens.student)

    const response = await my(ctx.tokens.student).expect(200)

    expect(items(response)[0].createdAt).toMatch(/Z$/)
  })
})
