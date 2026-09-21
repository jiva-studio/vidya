import { INestApplication } from '@nestjs/common'
import { HomeworkService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/homework', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.homework

  const answer = (text = 'My answer') =>
    app.get(HomeworkService).create({
      enrollmentId: ctx.enrollmentId,
      lessonVersionId: ctx.publishedVersionId,
      sectionId: ctx.sectionId,
      schoolId: ctx.schoolId,
      status: 'pending',
      text,
    })

  const review = (id: string, body: protocol.ReviewHomeworkRequest, token: string) =>
    request(app.getHttpServer()).patch(routes.review(id)).auth(token, { type: 'bearer' }).send(body)

  /* -------------------------------------------------------------------------- */
  /*                                  Reviewing                                 */
  /* -------------------------------------------------------------------------- */

  it('refuses to let a student grade their own work', async () => {
    const created = await answer()

    return review(created.id, { status: 'accepted', grade: 100 }, ctx.tokens.student).expect(403)
  })

  it('accepts work with a grade', async () => {
    const created = await answer()

    const response = await review(
      created.id,
      { status: 'accepted', grade: 5 },
      ctx.tokens.teacher,
    ).expect(200)

    expect(response.body.status).toBe('accepted')
    expect(response.body.grade).toBe(5)
  })

  it('refuses a transition the lifecycle does not allow', async () => {
    const created = await answer()
    await review(created.id, { status: 'accepted', grade: 5 }, ctx.tokens.teacher).expect(200)

    // Accepted is terminal.
    return review(created.id, { status: 'returned' }, ctx.tokens.teacher).expect(409)
  })

  /* -------------------------------------------------------------------------- */
  /*                                   Reading                                  */
  /* -------------------------------------------------------------------------- */

  it('lets a student read their own work', async () => {
    const created = await answer()

    return request(app.getHttpServer())
      .get(routes.get(created.id))
      .auth(ctx.tokens.student, { type: 'bearer' })
      .expect(200)
  })

  it('does not let another student read it', async () => {
    const created = await answer()

    return request(app.getHttpServer())
      .get(routes.get(created.id))
      .auth(ctx.tokens.stranger, { type: 'bearer' })
      .expect(403)
  })

  it('lets a teacher read it', async () => {
    const created = await answer()

    return request(app.getHttpServer())
      .get(routes.get(created.id))
      .auth(ctx.tokens.teacher, { type: 'bearer' })
      .expect(200)
  })
})
