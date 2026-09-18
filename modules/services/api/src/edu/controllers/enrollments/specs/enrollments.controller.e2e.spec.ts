import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/enrollments', () => {
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

  const enrol = (token: string) =>
    request(app.getHttpServer())
      .post(routes.create())
      .auth(token, { type: 'bearer' })
      .send({ courseId: ctx.courseId })

  /* -------------------------------------------------------------------------- */
  /*                                  Enrolling                                 */
  /* -------------------------------------------------------------------------- */

  it('lets a student with no permissions enrol', async () => {
    // Access comes from being enrolled; requiring a permission would make enrolling impossible.
    const response = await enrol(ctx.tokens.student).expect(201)

    expect(response.body.id).toBeDefined()
  })

  it('still requires authentication', () => {
    return request(app.getHttpServer())
      .post(routes.create())
      .send({ courseId: ctx.courseId })
      .expect(401)
  })

  it('refuses a second request for the same course', async () => {
    await enrol(ctx.tokens.student).expect(201)

    return enrol(ctx.tokens.student).expect(409)
  })

  it('starts pending, with no group', async () => {
    const created = await enrol(ctx.tokens.student).expect(201)

    const response = await request(app.getHttpServer())
      .get(routes.get(created.body.id))
      .auth(ctx.tokens.student, { type: 'bearer' })
      .expect(200)

    expect(response.body.status).toBe('pending')
    expect(response.body.groupId).toBeFalsy()
  })

  it('shows a student only their own enrollments', async () => {
    await enrol(ctx.tokens.student).expect(201)

    const response = await request(app.getHttpServer())
      .get(routes.find())
      .auth(ctx.tokens.otherStudent, { type: 'bearer' })
      .expect(200)

    expect(response.body.items).toHaveLength(0)
  })

  it("does not let one student read another's enrollment", async () => {
    const created = await enrol(ctx.tokens.student).expect(201)

    return request(app.getHttpServer())
      .get(routes.get(created.body.id))
      .auth(ctx.tokens.otherStudent, { type: 'bearer' })
      .expect(403)
  })

  /* -------------------------------------------------------------------------- */
  /*                                 Moderation                                 */
  /* -------------------------------------------------------------------------- */

  it('requires the moderate permission to decide', async () => {
    const created = await enrol(ctx.tokens.student).expect(201)

    return request(app.getHttpServer())
      .patch(routes.moderate(created.body.id))
      .auth(ctx.tokens.observer, { type: 'bearer' })
      .send({ status: 'accepted' })
      .expect(403)
  })

  it('accepts without a group, leaving the student in the queue', async () => {
    const created = await enrol(ctx.tokens.student).expect(201)

    const response = await request(app.getHttpServer())
      .patch(routes.moderate(created.body.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'accepted' })
      .expect(200)

    expect(response.body.status).toBe('accepted')
    expect(response.body.groupId).toBeFalsy()
  })

  it('accepts straight into a group', async () => {
    const created = await enrol(ctx.tokens.student).expect(201)

    const response = await request(app.getHttpServer())
      .patch(routes.moderate(created.body.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'accepted', groupId: ctx.groupId })
      .expect(200)

    expect(response.body.groupId).toBe(ctx.groupId)
  })

  it('refuses a group belonging to a different course', async () => {
    // Otherwise a student ends up with a place on a course they never applied to.
    const created = await enrol(ctx.tokens.student).expect(201)

    return request(app.getHttpServer())
      .patch(routes.moderate(created.body.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'accepted', groupId: ctx.foreignGroupId })
      .expect(409)
  })

  it('refuses to decide the same request twice', async () => {
    const created = await enrol(ctx.tokens.student).expect(201)

    await request(app.getHttpServer())
      .patch(routes.moderate(created.body.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'declined' })
      .expect(200)

    return request(app.getHttpServer())
      .patch(routes.moderate(created.body.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'accepted' })
      .expect(409)
  })

  /* -------------------------------------------------------------------------- */
  /*                             Group assignment                               */
  /* -------------------------------------------------------------------------- */

  it('moves an accepted student out of the queue into a group', async () => {
    const created = await enrol(ctx.tokens.student).expect(201)

    await request(app.getHttpServer())
      .patch(routes.moderate(created.body.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'accepted' })
      .expect(200)

    const response = await request(app.getHttpServer())
      .patch(routes.group(created.body.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ groupId: ctx.groupId })
      .expect(200)

    expect(response.body.groupId).toBe(ctx.groupId)
  })

  it('does not assign a group to a request that is still pending', async () => {
    const created = await enrol(ctx.tokens.student).expect(201)

    return request(app.getHttpServer())
      .patch(routes.group(created.body.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ groupId: ctx.groupId })
      .expect(409)
  })
})
