import { INestApplication } from '@nestjs/common'
import { EnrollmentsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
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

  afterEach(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.enrollments

  const place = (overrides: Record<string, unknown> = {}) =>
    app.get(EnrollmentsService).create({
      courseId: domain.asId<domain.CourseId>(ctx.courseId),
      studentId: domain.asId<domain.UserId>(ctx.studentId),
      schoolId: domain.asId<domain.SchoolId>(ctx.schoolId),
      ...overrides,
    })

  /* -------------------------------------------------------------------------- */
  /*                            What a request starts as                        */
  /* -------------------------------------------------------------------------- */

  it('starts pending, with no group', async () => {
    const asked = await place()

    const response = await request(app.getHttpServer())
      .get(routes.get(asked.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .expect(200)

    expect(response.body.status).toBe('pending')
    expect(response.body.groupId).toBeFalsy()
  })

  it('shows a student only their own enrollments', async () => {
    await place()

    const response = await request(app.getHttpServer())
      .get(routes.find())
      .auth(ctx.tokens.otherStudent, { type: 'bearer' })
      .expect(200)

    expect(response.body.items).toHaveLength(0)
  })

  it("does not let one student read another's enrollment", async () => {
    const asked = await place()

    return request(app.getHttpServer())
      .get(routes.get(asked.id))
      .auth(ctx.tokens.otherStudent, { type: 'bearer' })
      .expect(403)
  })

  /* -------------------------------------------------------------------------- */
  /*                                 Moderation                                 */
  /* -------------------------------------------------------------------------- */

  it('requires the moderate permission to decide', async () => {
    const asked = await place()

    return request(app.getHttpServer())
      .patch(routes.moderate(asked.id))
      .auth(ctx.tokens.observer, { type: 'bearer' })
      .send({ status: 'accepted' })
      .expect(403)
  })

  it('accepts without a group, leaving the student in the queue', async () => {
    const asked = await place()

    const response = await request(app.getHttpServer())
      .patch(routes.moderate(asked.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'accepted' })
      .expect(200)

    expect(response.body.status).toBe('accepted')
    expect(response.body.groupId).toBeFalsy()
  })

  it('accepts straight into a group', async () => {
    const asked = await place()

    const response = await request(app.getHttpServer())
      .patch(routes.moderate(asked.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'accepted', groupId: ctx.groupId })
      .expect(200)

    expect(response.body.groupId).toBe(ctx.groupId)
  })

  it('refuses a group belonging to a different course', async () => {
    // Otherwise a student ends up with a place on a course they never applied to.
    const asked = await place()

    return request(app.getHttpServer())
      .patch(routes.moderate(asked.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'accepted', groupId: ctx.foreignGroupId })
      .expect(409)
  })

  it('refuses to decide the same request twice', async () => {
    const asked = await place()

    await request(app.getHttpServer())
      .patch(routes.moderate(asked.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'declined' })
      .expect(200)

    return request(app.getHttpServer())
      .patch(routes.moderate(asked.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'accepted' })
      .expect(409)
  })

  /* -------------------------------------------------------------------------- */
  /*                             Group assignment                               */
  /* -------------------------------------------------------------------------- */

  it('moves an accepted student out of the queue into a group', async () => {
    const asked = await place()

    await request(app.getHttpServer())
      .patch(routes.moderate(asked.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ status: 'accepted' })
      .expect(200)

    const response = await request(app.getHttpServer())
      .patch(routes.group(asked.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ groupId: ctx.groupId })
      .expect(200)

    expect(response.body.groupId).toBe(ctx.groupId)
  })

  it('does not assign a group to a request that is still pending', async () => {
    const asked = await place()

    return request(app.getHttpServer())
      .patch(routes.group(asked.id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send({ groupId: ctx.groupId })
      .expect(409)
  })
})
