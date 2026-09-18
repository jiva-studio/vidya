import { INestApplication } from '@nestjs/common'
import { toRoleSummaries } from '@vidya/api/edu/mappers/org.mapper'
import { createTestingApp } from '@vidya/api/edu/shared'
import { Routes } from '@vidya/protocol'
import { instanceToPlain } from 'class-transformer'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/roles', () => {
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

  it(`GET /edu/roles returns 401 for unauthorized users`, () => {
    return request(app.getHttpServer()).get(Routes().edu.roles.find()).expect(401).expect({
      message: 'Unauthorized',
      statusCode: 401,
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                               Positive Cases                               */
  /* -------------------------------------------------------------------------- */

  it(`GET /edu/roles returns only permitted roles`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.roles.find())
      .set('Authorization', `Bearer ${ctx.one.tokens.owner}`)
      .expect(200)
      .expect({
        items: instanceToPlain(toRoleSummaries([ctx.one.roles.owner, ctx.one.roles.readonly])),
      })
  })

  it(`GET /edu/roles returns only permitted roles (multiple schools)`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.roles.find())
      .set('Authorization', `Bearer ${ctx.one.tokens.oneAndTwoAdmin}`)
      .expect(200)
      .expect({
        items: instanceToPlain(
          toRoleSummaries([ctx.one.roles.owner, ctx.one.roles.readonly, ctx.two.roles.admin]),
        ),
      })
  })

  /* -------------------------------------------------------------------------- */
  /*                               Negative Cases                               */
  /* -------------------------------------------------------------------------- */

  it(`GET /edu/roles returns nothing if user do not have permissions`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.roles.find())
      .set('Authorization', `Bearer ${ctx.three.tokens.admin}`)
      .expect(200)
      .expect({ items: [] })
  })

  it(`GET /edu/roles returns nothing if user do not have any permissions`, async () => {
    return request(app.getHttpServer())
      .get(Routes().edu.roles.find())
      .set('Authorization', `Bearer ${ctx.empty.tokens.noPermissions}`)
      .expect(403)
  })
})
