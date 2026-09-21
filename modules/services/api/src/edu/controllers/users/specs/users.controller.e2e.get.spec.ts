import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { onTheWire } from '@vidya/api/edu/shared'
import { Routes } from '@vidya/protocol'
import { instanceToPlain } from 'class-transformer'
import * as request from 'supertest'

import { toUserDetails } from '../../../mappers/org.mapper'
import { Context, createContext } from './context'

describe('/edu/users', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
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

  // By name, so the list reads alphabetically rather than in whatever order
  // the rows happen to come back in, and by identity, because the roles a row
  // carries are the ones held in the schools being listed.
  it(`GET /edu/users returns permitted users, in name order`, async () => {
    const response = await request(app.getHttpServer())
      .get(Routes().edu.user().find())
      .set('Authorization', `Bearer ${ctx.one.tokens.oneAdmin}`)
      .expect(200)

    expect(response.body.total).toBe(2)
    expect(response.body.items.map((item: { name: string }) => item.name)).toEqual([
      'Admin of One and Two',
      'Org Admin',
    ])
  })

  it(`GET /edu/users filtered by schoolId`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.user().find())
      .query({ schoolId: ctx.two.school.id })
      .set('Authorization', `Bearer ${ctx.one.tokens.oneAdmin}`)
      .expect(200)
      .expect({ items: [], total: 0 })
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
      .expect({ items: [], total: 0 })
  })
})
