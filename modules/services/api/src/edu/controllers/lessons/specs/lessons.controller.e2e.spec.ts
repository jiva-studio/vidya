import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import { createTestingApp, newId } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/lessons', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.lessons

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

  it('lists only the lessons of the schools the token covers', async () => {
    const response = await request(app.getHttpServer())
      .get(routes.find())
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(200)

    const body = response.body as protocol.GetLessonsResponse

    expect(body.items).toHaveLength(1)
    expect(body.items[0].id).toBe(ctx.lessonId)
  })

  it('reads one lesson by id', async () => {
    const response = await request(app.getHttpServer())
      .get(routes.get(ctx.lessonId))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(200)

    const body = response.body as protocol.GetLessonResponse

    expect(body.title).toBe('Introduction')
    expect(body.lessonNumber).toBe(1)
  })

  it('answers 404 for a lesson in another school', () => {
    return request(app.getHttpServer())
      .get(routes.get(ctx.otherLessonId))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(404)
  })

  it('rejects a malformed id before reaching the handler', () => {
    return request(app.getHttpServer())
      .get(routes.get('not-a-uuid'))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(400)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Creating                                  */
  /* -------------------------------------------------------------------------- */

  it('creates a lesson and opens an empty draft for it', async () => {
    // The editor should never have to create the first version by hand.
    const response = await request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.tokens.author, { type: 'bearer' })
      .send({ courseId: ctx.courseId, lessonNumber: 2, title: 'Second' })
      .expect(201)

    const created = response.body as protocol.CreateLessonResponse
    const versions = await request(app.getHttpServer())
      .get(protocol.Routes().edu.lessons.versions.all(created.id))
      .auth(ctx.tokens.author, { type: 'bearer' })
      .expect(200)

    const body = versions.body as protocol.GetLessonVersionsResponse

    expect(body.items).toHaveLength(1)
    expect(body.items[0].status).toBe('draft')
    expect(body.items[0].version).toBe(1)
  })

  it('takes the school from the course rather than the request', async () => {
    const response = await request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.tokens.author, { type: 'bearer' })
      .send({ courseId: ctx.courseId, lessonNumber: 3, title: 'Third' })
      .expect(201)

    const created = response.body as protocol.CreateLessonResponse

    // Readable by this school's token, which is only true if schoolId was set.
    return request(app.getHttpServer())
      .get(routes.get(created.id))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(200)
  })

  it('refuses to create a lesson under a course the caller cannot see', () => {
    return request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.tokens.author, { type: 'bearer' })
      .send({ courseId: ctx.otherCourseId, lessonNumber: 9, title: 'Smuggled' })
      .expect(404)
  })

  it('refuses to create a lesson without the permission', () => {
    return request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .send({ courseId: ctx.courseId, lessonNumber: 4, title: 'Fourth' })
      .expect(403)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Updating                                  */
  /* -------------------------------------------------------------------------- */

  it('retitles a lesson', async () => {
    await request(app.getHttpServer())
      .patch(routes.update(ctx.lessonId))
      .auth(ctx.tokens.author, { type: 'bearer' })
      .send({ title: 'Renamed' })
      .expect(200)

    const read = await request(app.getHttpServer())
      .get(routes.get(ctx.lessonId))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(200)

    expect((read.body as protocol.GetLessonResponse).title).toBe('Renamed')
  })

  it('refuses to retitle without the permission', () => {
    return request(app.getHttpServer())
      .patch(routes.update(ctx.lessonId))
      .auth(ctx.tokens.noPermissions, { type: 'bearer' })
      .send({ title: 'Renamed' })
      .expect(403)
  })

  it('cannot retitle a lesson in another school', () => {
    return request(app.getHttpServer())
      .patch(routes.update(ctx.otherLessonId))
      .auth(ctx.tokens.author, { type: 'bearer' })
      .send({ title: 'Renamed' })
      .expect(404)
  })

  it('refuses to retitle a lesson when holding update in another school and only read in this school', async () => {
    const auth = app.get(AuthService)
    const token = (
      await auth.generateTokens(newId<domain.UserId>(), [
        { sid: ctx.schoolId, p: ['lessons:update'] },
        { sid: ctx.otherSchoolId, p: ['lessons:read'] },
      ])
    ).accessToken

    return request(app.getHttpServer())
      .patch(routes.update(ctx.otherLessonId))
      .auth(token, { type: 'bearer' })
      .send({ title: 'Renamed' })
      .expect(403)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Deleting                                  */
  /* -------------------------------------------------------------------------- */

  it('deletes a lesson', async () => {
    await request(app.getHttpServer())
      .delete(routes.delete(ctx.lessonId))
      .auth(ctx.tokens.author, { type: 'bearer' })
      .expect(200)

    return request(app.getHttpServer())
      .get(routes.get(ctx.lessonId))
      .auth(ctx.tokens.author, { type: 'bearer' })
      .expect(404)
  })

  it('refuses to delete without the permission', () => {
    return request(app.getHttpServer())
      .delete(routes.delete(ctx.lessonId))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(403)
  })

  it('cannot delete a lesson in another school', () => {
    return request(app.getHttpServer())
      .delete(routes.delete(ctx.otherLessonId))
      .auth(ctx.tokens.author, { type: 'bearer' })
      .expect(404)
  })

  it('refuses to delete a lesson when holding delete in another school and only read in this school', async () => {
    const auth = app.get(AuthService)
    const token = (
      await auth.generateTokens(newId<domain.UserId>(), [
        { sid: ctx.schoolId, p: ['lessons:delete'] },
        { sid: ctx.otherSchoolId, p: ['lessons:read'] },
      ])
    ).accessToken

    return request(app.getHttpServer())
      .delete(routes.delete(ctx.otherLessonId))
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
