import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import { EnrollmentsService, UsersService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

const routes = protocol.Routes().edu.enrollments

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

/**
 * The school puts an answered row out of its own sight.
 *
 * The same key that answers a request tidies the list afterwards, because
 * whoever moderates is who ends up with the list to keep.
 */
describe('PATCH /edu/enrollments/:id/archive', () => {
  let app: INestApplication
  let ctx: Context

  /** A moderator whose id the assertions can name. */
  let moderatorId: domain.UserId
  let moderatorToken: string

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)

    const moderator = await app.get(UsersService).create({ email: faker.internet.email() })

    moderatorId = moderator.id
    moderatorToken = (
      await app.get(AuthService).generateTokens(moderator.id, [
        {
          sid: domain.asId<domain.SchoolId>(ctx.schoolId),
          p: ['enrollments:read', 'enrollments:moderate'],
        },
      ])
    ).accessToken
  })

  afterEach(async () => {
    await app.close()
  })

  const place = (status: domain.EnrollmentStatus, overrides: Record<string, unknown> = {}) =>
    app.get(EnrollmentsService).create({
      courseId: domain.asId<domain.CourseId>(ctx.courseId),
      studentId: domain.asId<domain.UserId>(ctx.studentId),
      schoolId: domain.asId<domain.SchoolId>(ctx.schoolId),
      status,
      ...overrides,
    })

  const archive = (id: string, token: string) =>
    request(app.getHttpServer()).patch(routes.archive(id)).auth(token, { type: 'bearer' })

  const items = (response: request.Response) =>
    (response.body as protocol.GetEnrollmentsResponse).items.map((item) => item.id)

  it('answers with the row as it now stands, stamped and signed', async () => {
    const refused = await place('declined')

    const response = await archive(refused.id, moderatorToken).expect(200)
    const details = response.body as protocol.ArchiveEnrollmentResponse

    expect(details.archivedBySchoolAt).toMatch(/Z$/)
    expect(details.archivedBySchoolById).toBe(moderatorId)
    expect(details.status).toBe('declined')
  })

  it('takes the row out of the list the school reads', async () => {
    const refused = await place('declined')

    await archive(refused.id, moderatorToken).expect(200)

    const list = await request(app.getHttpServer())
      .get(routes.find())
      .auth(moderatorToken, { type: 'bearer' })
      .expect(200)

    expect(items(list)).not.toContain(refused.id)
  })

  it('leaves the row in the list the student reads', async () => {
    // The student was revoked and is owed the explanation, however tidy the
    // school wants its own screen to be.
    const taken = await place('revoked')

    await archive(taken.id, moderatorToken).expect(200)

    const mine = await request(app.getHttpServer())
      .get(routes.find())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .expect(200)

    expect(items(mine)).toContain(taken.id)
  })

  it('refuses to hide a request nobody has answered yet', async () => {
    const waiting = await place('pending')

    await archive(waiting.id, moderatorToken).expect(409)
  })

  it('refuses to hide a student who is still studying', async () => {
    const studying = await place('accepted', { groupId: ctx.groupId })

    await archive(studying.id, moderatorToken).expect(409)
  })

  it('refuses staff who may read the list but not decide on it', async () => {
    const refused = await place('declined')

    await archive(refused.id, ctx.tokens.observer).expect(403)
  })

  it('refuses the student whose row it is', async () => {
    const refused = await place('declined')

    await archive(refused.id, ctx.tokens.student).expect(403)
  })

  it('answers 404 for a row that does not exist', () =>
    archive(UNKNOWN_ID, moderatorToken).expect(404))

  it('answers 401 without a token', async () => {
    const refused = await place('declined')

    await request(app.getHttpServer()).patch(routes.archive(refused.id)).expect(401)
  })
})
