import { INestApplication } from '@nestjs/common'
import { toUserDetails } from '@vidya/api/edu/mappers/org.mapper'
import { createTestingApp, onTheWire } from '@vidya/api/edu/shared'
import { Routes } from '@vidya/protocol'
import { instanceToPlain } from 'class-transformer'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/users (PATCH)', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 401 for unauthenticated request', () => {
    return request(app.getHttpServer())
      .patch(Routes().edu.user(ctx.one.users.oneAdmin.id).update())
      .send({ name: 'New Name' })
      .expect(401)
  })

  it('allows a user without permissions to update their own name', async () => {
    const emptyUserToken = await ctx.getAuthTokenFor(ctx.misc.users.empty)

    const res = await request(app.getHttpServer())
      .patch(Routes().edu.user(ctx.misc.users.empty.id).update())
      .set('Authorization', emptyUserToken)
      .send({ name: 'Self Renamed' })
      .expect(200)

    expect(res.body.name).toBe('Self Renamed')
  })

  it('refuses to let a user without permissions update their own email', async () => {
    const emptyUserToken = await ctx.getAuthTokenFor(ctx.misc.users.empty)

    return request(app.getHttpServer())
      .patch(Routes().edu.user(ctx.misc.users.empty.id).update())
      .set('Authorization', emptyUserToken)
      .send({ email: 'newemail@example.com' })
      .expect(403)
  })

  it('refuses to let a user without permissions update another user', async () => {
    const emptyUserToken = await ctx.getAuthTokenFor(ctx.misc.users.empty)

    return request(app.getHttpServer())
      .patch(Routes().edu.user(ctx.one.users.oneAdmin.id).update())
      .set('Authorization', emptyUserToken)
      .send({ name: 'Hacked' })
      .expect(403)
  })

  it('allows an administrator with users:update to update another user', async () => {
    const res = await request(app.getHttpServer())
      .patch(Routes().edu.user(ctx.one.users.oneAdmin.id).update())
      .set('Authorization', `Bearer ${ctx.one.tokens.oneAdmin}`)
      .send({ name: 'Admin Renamed' })
      .expect(200)

    expect(res.body.name).toBe('Admin Renamed')
  })
})
