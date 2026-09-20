import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/groups', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.groups

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

  it('lists only the groups of the schools the token covers', async () => {
    const response = await request(app.getHttpServer())
      .get(routes.find())
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(200)

    const body = response.body as protocol.GetGroupsResponse

    expect(body.items).toHaveLength(1)
    expect(body.items[0].id).toBe(ctx.groupId)
  })

  it('narrows the list to one course when asked', async () => {
    const response = await request(app.getHttpServer())
      .get(`${routes.find()}?courseId=${ctx.otherCourseId}`)
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(200)

    // The course belongs to another school, so scope wins over the filter.
    expect((response.body as protocol.GetGroupsResponse).items).toHaveLength(0)
  })

  it('reads one group by id', async () => {
    const response = await request(app.getHttpServer())
      .get(routes.get(ctx.groupId))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(200)

    expect((response.body as protocol.GetGroupResponse).name).toBe('Morning group')
  })

  it('answers 404 for a group in another school', async () => {
    // A 403 would confirm the id exists, which in a multi-tenant system is a disclosure.
    return request(app.getHttpServer())
      .get(routes.get(ctx.otherGroupId))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(404)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Creating                                  */
  /* -------------------------------------------------------------------------- */

  it('creates a group and takes its school from the course', async () => {
    const response = await request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.tokens.admin, { type: 'bearer' })
      .send({ courseId: ctx.courseId, name: 'Evening group' })
      .expect(201)

    const created = response.body as protocol.CreateGroupResponse
    const read = await request(app.getHttpServer())
      .get(routes.get(created.id))
      .auth(ctx.tokens.admin, { type: 'bearer' })
      .expect(200)

    expect((read.body as protocol.GetGroupResponse).courseId).toBe(ctx.courseId)
  })

  it('refuses to create a group under a course the caller cannot see', async () => {
    return request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.tokens.admin, { type: 'bearer' })
      .send({ courseId: ctx.otherCourseId, name: 'Smuggled' })
      .expect(404)
  })

  it('refuses to create a group without the permission', async () => {
    return request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .send({ courseId: ctx.courseId, name: 'Evening group' })
      .expect(403)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Updating                                  */
  /* -------------------------------------------------------------------------- */

  it('renames a group', async () => {
    await request(app.getHttpServer())
      .patch(routes.update(ctx.groupId))
      .auth(ctx.tokens.admin, { type: 'bearer' })
      .send({ name: 'Renamed' })
      .expect(200)

    const read = await request(app.getHttpServer())
      .get(routes.get(ctx.groupId))
      .auth(ctx.tokens.admin, { type: 'bearer' })
      .expect(200)

    expect((read.body as protocol.GetGroupResponse).name).toBe('Renamed')
  })

  it('refuses to rename without the permission', () => {
    return request(app.getHttpServer())
      .patch(routes.update(ctx.groupId))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .send({ name: 'Renamed' })
      .expect(403)
  })

  it('cannot rename a group in another school', () => {
    return request(app.getHttpServer())
      .patch(routes.update(ctx.otherGroupId))
      .auth(ctx.tokens.admin, { type: 'bearer' })
      .send({ name: 'Renamed' })
      .expect(404)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Deleting                                  */
  /* -------------------------------------------------------------------------- */

  it('deletes a group', async () => {
    await request(app.getHttpServer())
      .delete(routes.delete(ctx.groupId))
      .auth(ctx.tokens.admin, { type: 'bearer' })
      .expect(200)

    return request(app.getHttpServer())
      .get(routes.get(ctx.groupId))
      .auth(ctx.tokens.admin, { type: 'bearer' })
      .expect(404)
  })

  it('refuses to delete without the permission', () => {
    return request(app.getHttpServer())
      .delete(routes.delete(ctx.groupId))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(403)
  })

  it('cannot delete a group in another school', () => {
    return request(app.getHttpServer())
      .delete(routes.delete(ctx.otherGroupId))
      .auth(ctx.tokens.admin, { type: 'bearer' })
      .expect(404)
  })

  it('rejects a malformed id before reaching the handler', () => {
    return request(app.getHttpServer())
      .get(routes.get('not-a-uuid'))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(400)
  })
})
