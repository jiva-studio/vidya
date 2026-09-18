import { INestApplication } from '@nestjs/common'
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

  afterAll(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.homework

  const submit = (token: string, text = 'My answer') =>
    request(app.getHttpServer()).post(routes.submit()).auth(token, { type: 'bearer' }).send({
      lessonVersionId: ctx.publishedVersionId,
      sectionId: ctx.sectionId,
      text,
    })

  const review = (id: string, body: protocol.ReviewHomeworkRequest, token: string) =>
    request(app.getHttpServer()).patch(routes.review(id)).auth(token, { type: 'bearer' }).send(body)

  /* -------------------------------------------------------------------------- */
  /*                                 Submitting                                 */
  /* -------------------------------------------------------------------------- */

  it('accepts work from an enrolled student', async () => {
    const response = await submit(ctx.tokens.student).expect(201)

    expect(response.body.status).toBe('pending')
    expect(response.body.submittedAt).toBeDefined()
  })

  it('refuses work from someone not enrolled', () => {
    return submit(ctx.tokens.stranger).expect(403)
  })

  it('refuses work when the enrollment is still pending', () => {
    // A request to join is not a place on the course.
    return submit(ctx.tokens.pendingStudent).expect(403)
  })

  it('freezes the answer once submitted', async () => {
    await submit(ctx.tokens.student, 'First answer').expect(201)

    return submit(ctx.tokens.student, 'Second thoughts').expect(409)
  })

  it('does not flag work answered against the current version', async () => {
    const response = await submit(ctx.tokens.student).expect(201)

    expect(response.body.answeredSupersededVersion).toBe(false)
  })

  it('accepts work answered against a superseded version, and flags it', async () => {
    // The student was offline when the revision was published; rejecting would punish them.
    const { LessonVersionsService } = await import('@vidya/api/edu/services')
    const versions = app.get(LessonVersionsService)
    const answered = await versions.findOneBy({ id: ctx.publishedVersionId })

    await versions.create({
      lessonId: answered.lessonId,
      version: answered.version + 1,
      status: 'published',
      publishedAt: new Date(),
      content: { sections: [] },
    })

    const response = await submit(ctx.tokens.student).expect(201)

    expect(response.body.status).toBe('pending')
    expect(response.body.answeredSupersededVersion).toBe(true)
  })

  /* -------------------------------------------------------------------------- */
  /*                                  Reviewing                                 */
  /* -------------------------------------------------------------------------- */

  it('refuses to let a student grade their own work', async () => {
    const created = await submit(ctx.tokens.student).expect(201)

    return review(created.body.id, { status: 'accepted', grade: 100 }, ctx.tokens.student).expect(
      403,
    )
  })

  it('accepts work with a grade', async () => {
    const created = await submit(ctx.tokens.student).expect(201)

    const response = await review(
      created.body.id,
      { status: 'accepted', grade: 5 },
      ctx.tokens.teacher,
    ).expect(200)

    expect(response.body.status).toBe('accepted')
    expect(response.body.grade).toBe(5)
  })

  it('returns work for revision, which unfreezes the answer', async () => {
    const created = await submit(ctx.tokens.student, 'First attempt').expect(201)

    await review(created.body.id, { status: 'returned' }, ctx.tokens.teacher).expect(200)

    const resubmitted = await submit(ctx.tokens.student, 'Second attempt').expect(201)
    expect(resubmitted.body.text).toBe('Second attempt')
    expect(resubmitted.body.status).toBe('pending')
  })

  it('refuses to edit work that has already been accepted', async () => {
    const created = await submit(ctx.tokens.student).expect(201)
    await review(created.body.id, { status: 'accepted', grade: 5 }, ctx.tokens.teacher).expect(200)

    // The one real conflict: work left a device's outbox after the server accepted it.
    const response = await submit(ctx.tokens.student, 'Too late').expect(409)
    expect(response.body.message).toMatch(/already been accepted/)
  })

  it('refuses a transition the lifecycle does not allow', async () => {
    const created = await submit(ctx.tokens.student).expect(201)
    await review(created.body.id, { status: 'accepted', grade: 5 }, ctx.tokens.teacher).expect(200)

    // Accepted is terminal.
    return review(created.body.id, { status: 'returned' }, ctx.tokens.teacher).expect(409)
  })

  /* -------------------------------------------------------------------------- */
  /*                                   Reading                                  */
  /* -------------------------------------------------------------------------- */

  it('lets a student read their own work', async () => {
    const created = await submit(ctx.tokens.student).expect(201)

    return request(app.getHttpServer())
      .get(routes.get(created.body.id))
      .auth(ctx.tokens.student, { type: 'bearer' })
      .expect(200)
  })

  it('does not let another student read it', async () => {
    const created = await submit(ctx.tokens.student).expect(201)

    return request(app.getHttpServer())
      .get(routes.get(created.body.id))
      .auth(ctx.tokens.stranger, { type: 'bearer' })
      .expect(403)
  })

  it('shows nothing to a student with no enrollments at all', async () => {
    // Regression: an empty OR list becomes `where: []`, which TypeORM reads as no filter.
    await submit(ctx.tokens.student).expect(201)

    const response = await request(app.getHttpServer())
      .get(routes.find())
      .auth(ctx.tokens.stranger, { type: 'bearer' })
      .expect(200)

    expect(response.body.items).toHaveLength(0)
  })

  it('shows a student only their own work in the list', async () => {
    const created = await submit(ctx.tokens.student).expect(201)

    const response = await request(app.getHttpServer())
      .get(routes.find())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .expect(200)

    expect(response.body.items).toHaveLength(1)
    expect(response.body.items[0].id).toBe(created.body.id)
  })

  it('lets a teacher read it', async () => {
    const created = await submit(ctx.tokens.student).expect(201)

    return request(app.getHttpServer())
      .get(routes.get(created.body.id))
      .auth(ctx.tokens.teacher, { type: 'bearer' })
      .expect(200)
  })
})
