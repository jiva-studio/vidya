import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { RolesService, SchoolsService, UserSchoolsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/users/:id/schools', () => {
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

  it(`POST /edu/users/:id/schools returns 401 for unauthenticated user`, () => {
    return request(app.getHttpServer())
      .post(Routes().edu.user(ctx.one.users.oneAdmin.id).schools.create())
      .send({ schoolId: faker.string.uuid() })
      .expect(401)
      .expect({
        message: 'Unauthorized',
        statusCode: 401,
      })
  })

  it(`POST /edu/users/:id/schools returns 403 for unauthorized user`, async () => {
    return request(app.getHttpServer())
      .post(Routes().edu.user(ctx.one.users.oneAdmin.id).schools.create())
      .set('Authorization', await ctx.getAuthTokenFor(ctx.two.users.twoAdmin))
      .send({ schoolId: ctx.two.school.id })
      .expect(403)
      .expect({
        message: 'User does not have permission',
        error: 'Forbidden',
        statusCode: 403,
      })
  })

  /* -------------------------------------------------------------------------- */
  /*                              Joining a school                              */
  /* -------------------------------------------------------------------------- */

  const join = (userId: string, schoolId: string, token: string) =>
    request(app.getHttpServer())
      .post(Routes().edu.user(userId).schools.create())
      .set('Authorization', token)
      .send({ schoolId })

  it('refuses to join a school whose settings name no role for a new student', async () => {
    const joiner = ctx.misc.users.empty
    const token = await ctx.getAuthTokenFor(joiner)

    const response = await join(joiner.id, ctx.one.school.id, token).expect(409)

    expect(String(response.body.message)).toMatch(/student/i)
    expect(await app.get(UserSchoolsService).getUserSchools(joiner.id)).not.toContain(
      ctx.one.school.id,
    )
  })

  it('refuses to join a school whose configured student role has since been deleted', async () => {
    const joiner = ctx.misc.users.empty
    const token = await ctx.getAuthTokenFor(joiner)

    const roles = app.get(RolesService)
    const studentRole = await roles.create({
      name: 'Student',
      description: 'Student role for school one',
      schoolId: ctx.one.school.id,
      permissions: [],
    })
    await app
      .get(SchoolsService)
      .updateOneBy({ id: ctx.one.school.id }, { config: { defaultStudentRoleId: studentRole.id } })
    await roles.deleteOneBy({ id: studentRole.id })

    const response = await join(joiner.id, ctx.one.school.id, token).expect(409)

    expect(String(response.body.message)).toMatch(/student/i)
    expect(await app.get(UserSchoolsService).getUserSchools(joiner.id)).not.toContain(
      ctx.one.school.id,
    )
  })

  it('joins a properly configured school with the role its settings name', async () => {
    const joiner = ctx.misc.users.empty
    const token = await ctx.getAuthTokenFor(joiner)

    const studentRole = await app.get(RolesService).create({
      name: 'Student',
      description: 'Student role for school one',
      schoolId: ctx.one.school.id,
      permissions: [],
    })
    await app
      .get(SchoolsService)
      .updateOneBy({ id: ctx.one.school.id }, { config: { defaultStudentRoleId: studentRole.id } })

    await join(joiner.id, ctx.one.school.id, token).expect(201)

    expect(await app.get(UserSchoolsService).getUserSchools(joiner.id)).toContain(ctx.one.school.id)
    expect(await app.get(RolesService).getRolesOfUser(joiner.id)).toContainEqual(
      expect.objectContaining({ id: studentRole.id }),
    )
  })
})
