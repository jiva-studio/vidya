import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { toUserDetails, toUserSummaries } from '@vidya/api/edu/mappers/org.mapper'
import { createTestingApp } from '@vidya/api/edu/shared'
import { onTheWire } from '@vidya/api/edu/shared'
import { Routes } from '@vidya/protocol'
import { instanceToPlain } from 'class-transformer'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/users', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterAll(async () => {
    await app.close()
  })

  /* -------------------------------------------------------------------------- */
  /*                          Authentication Validation                         */
  /* -------------------------------------------------------------------------- */

  it(`GET /edu/users returns 401 for unauthenticated user`, () => {
    return request(app.getHttpServer()).get(Routes().edu.user().find()).expect(401).expect({
      message: 'Unauthorized',
      statusCode: 401,
    })
  })

  it(`GET /edu/users returns 403 for unauthorized user`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.user().find())
      .set('Authorization', `Bearer ${ctx.misc.tokens.empty}`)
      .expect(403)
      .expect({
        message: 'User does not have permission',
        error: 'Forbidden',
        statusCode: 403,
      })
  })

  /* -------------------------------------------------------------------------- */
  /*                               Positive Cases                               */
  /* -------------------------------------------------------------------------- */

  it(`GET /edu/users/:id returns the user by Id`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.user(ctx.one.users.oneAdmin.id).get())
      .set('Authorization', `Bearer ${ctx.one.tokens.oneAdmin}`)
      .expect(200)
      .expect(onTheWire(instanceToPlain(toUserDetails(ctx.one.users.oneAdmin))))
  })

  it(`GET /edu/users returns permitted users`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.user().find())
      .set('Authorization', `Bearer ${ctx.one.tokens.oneAdmin}`)
      .expect(200)
      .expect({
        items: instanceToPlain(
          toUserSummaries([ctx.one.users.oneAdmin, ctx.misc.users.adminOfOneAndTwo]),
        ),
      })
  })

  it(`GET /edu/users filtered by schoolId`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.user().find())
      .query({ schoolId: ctx.two.school.id })
      .set('Authorization', `Bearer ${ctx.one.tokens.oneAdmin}`)
      .expect(200)
      .expect({ items: [] })
  })

  /* -------------------------------------------------------------------------- */
  /*                               Negative Cases                               */
  /* -------------------------------------------------------------------------- */

  it(`GET /edu/users/:id returns 404 if user is not found`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.user(faker.string.uuid()).get())
      .set('Authorization', `Bearer ${ctx.one.tokens.oneAdmin}`)
      .expect(404)
  })

  it(`GET /edu/users/:id returns 404 user has no access to it`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.user(ctx.two.users.twoAdmin.id).get())
      .set('Authorization', `Bearer ${ctx.one.tokens.oneAdmin}`)
      .expect(404)
  })

  it(`GET /edu/users returns nothing if user do not have permissions`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.user().find())
      .set('Authorization', `Bearer ${ctx.misc.tokens.dummy}`)
      .expect(200)
      .expect({ items: [] })
  })
})
