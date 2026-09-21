import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import { RolesService } from '@vidya/api/edu/services'
import { createTestingApp, newId } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
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

  it('refuses to grant a role containing permissions the caller lacks in that school', async () => {
    const rolesService = app.get(RolesService)
    const superRole = await rolesService.create({
      name: 'Lessons Superuser',
      schoolId: ctx.one.school.id,
      permissions: ['lessons:delete', 'lessons:publish'],
    })

    // ctx.one.tokens.oneAdmin holds users:* in school one, but lacks lessons:delete and lessons:publish
    return request(app.getHttpServer())
      .post(routes(ctx.misc.users.empty.id).create())
      .auth(ctx.one.tokens.oneAdmin, { type: 'bearer' })
      .send({ roleIds: [superRole.id] })
      .expect(403)
  })

  it('refuses to grant a role when caller holds permissions in another school but not in target school', async () => {
    const rolesService = app.get(RolesService)
    const superRole = await rolesService.create({
      name: 'Lessons Superuser in One',
      schoolId: ctx.one.school.id,
      permissions: ['lessons:delete'],
    })

    const auth = app.get(AuthService)
    const token = (
      await auth.generateTokens(newId<domain.UserId>(), [
        { sid: ctx.two.school.id, p: ['*'] },
        { sid: ctx.one.school.id, p: ['users:update'] },
      ])
    ).accessToken

    return request(app.getHttpServer())
      .post(routes(ctx.misc.users.empty.id).create())
      .auth(token, { type: 'bearer' })
      .send({ roleIds: [superRole.id] })
      .expect(403)
  })
})
