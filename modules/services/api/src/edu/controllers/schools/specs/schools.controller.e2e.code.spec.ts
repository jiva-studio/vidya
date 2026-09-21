import { INestApplication } from '@nestjs/common'
import { SchoolsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

const routes = protocol.Routes().edu.schools

/**
 * Creating the code a joining link carries.
 *
 * School one is ready for students — its config names the role a joiner gets.
 * School two is not, and that difference is the whole of the last two cases: a
 * link to a school that cannot accept anyone meets its first visitor with a 500.
 */
describe('POST /edu/schools/:id/code', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const askForCode = (schoolId: string, token: string) =>
    request(app.getHttpServer()).post(routes.code(schoolId)).set('Authorization', token)

  it('refuses a caller who does not hold schools:update in that school', async () => {
    const token = await ctx.getAuthTokenFor(ctx.one.users.readonly)

    return askForCode(ctx.one.school.id, token).expect(403)
  })

  it('refuses a caller who holds schools:update in a different school', async () => {
    const token = await ctx.getAuthTokenFor(ctx.two.users.admin)

    return askForCode(ctx.one.school.id, token).expect(403)
  })

  it('creates six characters drawn from the alphabet a code is spelled in', async () => {
    const token = await ctx.getAuthTokenFor(ctx.one.users.owner)

    const response = await askForCode(ctx.one.school.id, token).expect(200)
    const { code } = response.body as protocol.CreateSchoolCodeResponse

    expect(code).toHaveLength(domain.SCHOOL_CODE_LENGTH)
    expect([...code].every((character) => domain.schoolCodeAlphabet().includes(character))).toBe(
      true,
    )
    expect(domain.isSchoolCode(code)).toBe(true)
  })

  it('returns the code the school already holds when asked a second time', async () => {
    const token = await ctx.getAuthTokenFor(ctx.one.users.owner)

    const first = await askForCode(ctx.one.school.id, token).expect(200)
    const second = await askForCode(ctx.one.school.id, token).expect(200)

    expect((second.body as protocol.CreateSchoolCodeResponse).code).toBe(
      (first.body as protocol.CreateSchoolCodeResponse).code,
    )
  })

  it('never hands two schools the same code', async () => {
    await app
      .get(SchoolsService)
      .updateOneBy(
        { id: ctx.two.school.id },
        { config: { defaultStudentRoleId: ctx.two.roles.admin.id } },
      )

    const one = await askForCode(
      ctx.one.school.id,
      await ctx.getAuthTokenFor(ctx.one.users.owner),
    ).expect(200)
    const two = await askForCode(
      ctx.two.school.id,
      await ctx.getAuthTokenFor(ctx.two.users.admin),
    ).expect(200)

    expect((two.body as protocol.CreateSchoolCodeResponse).code).not.toBe(
      (one.body as protocol.CreateSchoolCodeResponse).code,
    )
  })

  it('refuses a school that has no role to give a student, rather than creating one', async () => {
    const token = await ctx.getAuthTokenFor(ctx.two.users.admin)

    const response = await askForCode(ctx.two.school.id, token).expect(409)

    expect(String(response.body.message)).toMatch(/student/i)
  })

  it('leaves a school that has no role to give a student without a code at all', async () => {
    const token = await ctx.getAuthTokenFor(ctx.two.users.admin)

    await askForCode(ctx.two.school.id, token).expect(409)

    expect((await app.get(SchoolsService).findOneBy({ id: ctx.two.school.id })).code).toBeNull()
  })
})
