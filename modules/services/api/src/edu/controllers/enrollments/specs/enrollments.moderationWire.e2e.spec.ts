import { INestApplication } from '@nestjs/common'
import { EnrollmentsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

/**
 * What the moderation endpoint accepts on the wire.
 *
 * The service's own transition table is tested beside it; this is the layer in
 * front of it, where a status outside the three the school may choose has to
 * be refused by validation rather than reach the table at all.
 */
describe('/edu/enrollments/:id/moderation, as the wire sees it', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.enrollments

  // A student asks for a place through the sync engine, so the request itself
  // is fixture work here; the endpoint under test is the school's answer to it.
  const enrol = async (): Promise<string> => {
    const created = await app.get(EnrollmentsService).create({
      courseId: domain.asId<domain.CourseId>(ctx.courseId),
      studentId: domain.asId<domain.UserId>(ctx.studentId),
      schoolId: domain.asId<domain.SchoolId>(ctx.schoolId),
      status: 'pending',
    })

    return created.id
  }

  const decide = (id: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch(routes.moderate(id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .send(body)

  const accepted = async (): Promise<string> => {
    const id = await enrol()
    await decide(id, { status: 'accepted' }).expect(200)
    return id
  }

  it('takes a place back', async () => {
    const id = await accepted()

    const response = await decide(id, { status: 'revoked' }).expect(200)

    expect(response.body.status).toBe('revoked')
    expect(response.body.groupId).toBeFalsy()
  })

  // `withdrawn` is the student's own doing and `pending` is where a request
  // starts; neither is a decision the school may send.
  it.each(['withdrawn', 'pending', 'approved', '', null])(
    'refuses %p as a decision before it reaches the transition table',
    async (status) => {
      const id = await enrol()

      await decide(id, { status }).expect(400)

      const after = await request(app.getHttpServer())
        .get(routes.get(id))
        .auth(ctx.tokens.moderator, { type: 'bearer' })
        .expect(200)

      expect(after.body.status).toBe('pending')
    },
  )

  it('refuses a decision with no status at all', async () => {
    const id = await enrol()

    return decide(id, {}).expect(400)
  })

  it('refuses a group on a place it is taking back', async () => {
    const id = await accepted()

    await decide(id, { status: 'revoked', groupId: ctx.groupId }).expect(409)

    const after = await request(app.getHttpServer())
      .get(routes.get(id))
      .auth(ctx.tokens.moderator, { type: 'bearer' })
      .expect(200)

    expect(after.body.status).toBe('accepted')
  })

  it('refuses a group that is not a uuid', async () => {
    const id = await accepted()

    return decide(id, { status: 'accepted', groupId: 'not-a-uuid' }).expect(400)
  })
})
