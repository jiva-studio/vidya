import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/users/:userId/roles', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const routes = (userId: string) => protocol.Routes().edu.user(userId).roles

  it('returns 401 without a token', () => {
    return request(app.getHttpServer()).get(routes(ctx.one.users.oneAdmin.id).all()).expect(401)
  })

  it('lists the roles a user holds', async () => {
    const response = await request(app.getHttpServer())
      .get(routes(ctx.one.users.oneAdmin.id).all())
      .auth(ctx.one.tokens.oneAdmin, { type: 'bearer' })
      .expect(200)

    const body = response.body as protocol.GetUserRolesListResponse

    expect(body.userRoles.map((r) => r.roleId)).toContain(ctx.one.roles.oneAdmin.id)
  })

  /* -------------------------------------------------------------------------- */
  /*                               Privilege                                    */
  /* -------------------------------------------------------------------------- */

  it('refuses to hand a user a role when the caller has no authority over it', async () => {
    // Nothing but the authentication guard stood between any signed-in account
    // and granting itself an owner role in any school.
    return request(app.getHttpServer())
      .post(routes(ctx.misc.users.empty.id).create())
      .auth(ctx.misc.tokens.empty, { type: 'bearer' })
      .send({ roleIds: [ctx.one.roles.oneAdmin.id] })
      .expect(403)
  })

  it('refuses to read another user’s roles without permission', () => {
    return request(app.getHttpServer())
      .get(routes(ctx.one.users.oneAdmin.id).all())
      .auth(ctx.misc.tokens.empty, { type: 'bearer' })
      .expect(403)
  })

  it('lets an administrator of the school set roles in that school', async () => {
    await request(app.getHttpServer())
      .post(routes(ctx.misc.users.empty.id).create())
      .auth(ctx.one.tokens.oneAdmin, { type: 'bearer' })
      .send({ roleIds: [ctx.one.roles.oneAdmin.id] })
      .expect(201)

    const response = await request(app.getHttpServer())
      .get(routes(ctx.misc.users.empty.id).all())
      .auth(ctx.one.tokens.oneAdmin, { type: 'bearer' })
      .expect(200)

    const body = response.body as protocol.GetUserRolesListResponse

    expect(body.userRoles.map((r) => r.roleId)).toEqual([ctx.one.roles.oneAdmin.id])
  })

  it('refuses to grant a role belonging to another school', () => {
    return request(app.getHttpServer())
      .post(routes(ctx.misc.users.empty.id).create())
      .auth(ctx.one.tokens.oneAdmin, { type: 'bearer' })
      .send({ roleIds: [ctx.two.roles.twoAdmin.id] })
      .expect(403)
  })

  it('leaves alone the roles the user holds in another school', async () => {
    // Replacing the whole set would let an administrator of one school strip a
    // person of the job they hold somewhere else, just by saving a form.
    const user = ctx.misc.users.adminOfOneAndTwo

    await request(app.getHttpServer())
      .post(routes(user.id).create())
      .auth(ctx.one.tokens.oneAdmin, { type: 'bearer' })
      .send({ roleIds: [] })
      .expect(201)

    const asTwo = await request(app.getHttpServer())
      .get(routes(user.id).all())
      .set('Authorization', await ctx.getAuthTokenFor(ctx.two.users.twoAdmin))
      .expect(200)

    const body = asTwo.body as protocol.GetUserRolesListResponse

    expect(body.userRoles.map((r) => r.roleId)).toEqual([ctx.two.roles.twoAdmin.id])
  })
})
