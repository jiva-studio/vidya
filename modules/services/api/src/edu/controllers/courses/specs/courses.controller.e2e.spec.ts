import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/courses', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterAll(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.courses

  /* -------------------------------------------------------------------------- */
  /*                                   Reading                                  */
  /* -------------------------------------------------------------------------- */

  it('returns 401 without a token', () => {
    return request(app.getHttpServer()).get(routes.find()).expect(401)
  })

  it('returns 403 when the token carries no permissions', () => {
    return request(app.getHttpServer())
      .get(routes.find())
      .auth(ctx.tokens.noPermissions, { type: 'bearer' })
      .expect(403)
  })

  it('lists only the courses of the schools the token covers', async () => {
    const response = await request(app.getHttpServer())
      .get(routes.find())
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .expect(200)

    const body = response.body as protocol.GetCoursesResponse
    expect(body.items).toHaveLength(1)
    expect(body.items[0].name).toBe('Bhakti-shastri')
  })

  it("hides another school's course behind a 404 rather than a 403", async () => {
    // A 403 would confirm the id exists, which in a multi-tenant system is a disclosure.
    return request(app.getHttpServer())
      .get(routes.get(ctx.two.courseId))
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .expect(404)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Creating                                  */
  /* -------------------------------------------------------------------------- */

  it('creates a course in a school the token covers', async () => {
    const payload: protocol.CreateCourseRequest = {
      schoolId: ctx.one.school.id,
      name: 'New course',
      learningType: 'group',
    }

    const response = await request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .send(payload)
      .expect(201)

    expect(response.body.id).toBeDefined()
  })

  it('refuses to create a course in a school the token does not cover', () => {
    const payload: protocol.CreateCourseRequest = {
      schoolId: ctx.two.school.id,
      name: 'Smuggled course',
      learningType: 'group',
    }

    return request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .send(payload)
      .expect(403)
  })

  it('refuses to create a course with read-only permissions', () => {
    const payload: protocol.CreateCourseRequest = {
      schoolId: ctx.one.school.id,
      name: 'Another course',
      learningType: 'group',
    }

    return request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.one.tokens.readonly, { type: 'bearer' })
      .send(payload)
      .expect(403)
  })

  it('lets two schools run a course of the same name', async () => {
    // Course names used to be globally unique, which made this a 500.
    const payload: protocol.CreateCourseRequest = {
      schoolId: ctx.two.school.id,
      name: 'Bhakti-shastri',
      learningType: 'group',
    }

    return request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.two.tokens.admin, { type: 'bearer' })
      .send(payload)
      .expect(201)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Updating                                  */
  /* -------------------------------------------------------------------------- */

  it('updates a course in scope', async () => {
    const payload: protocol.UpdateCourseRequest = { name: 'Renamed' }

    const response = await request(app.getHttpServer())
      .patch(routes.update(ctx.one.courseId))
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .send(payload)
      .expect(200)

    expect(response.body.name).toBe('Renamed')
  })

  it('does not update a course belonging to another school', () => {
    return request(app.getHttpServer())
      .patch(routes.update(ctx.two.courseId))
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .send({ name: 'Hijacked' })
      .expect(404)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Deleting                                  */
  /* -------------------------------------------------------------------------- */

  it('deletes a course in scope', async () => {
    await request(app.getHttpServer())
      .delete(routes.delete(ctx.one.courseId))
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .expect(200)

    return request(app.getHttpServer())
      .get(routes.get(ctx.one.courseId))
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .expect(404)
  })

  it('does not delete a course belonging to another school', () => {
    return request(app.getHttpServer())
      .delete(routes.delete(ctx.two.courseId))
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .expect(404)
  })
})
