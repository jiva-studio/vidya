import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

const routes = protocol.Routes().edu.courses

/**
 * A course is prepared out of sight and then shown.
 *
 * Publication is a decision of its own, taken after the course exists, so the
 * cases here are about what a course starts as and what moves it either way.
 */
describe('/edu/courses, published and unpublished', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const create = async (): Promise<string> => {
    const payload: protocol.CreateCourseRequest = {
      schoolId: ctx.one.school.id,
      name: 'Bhagavad-gita in depth',
      learningType: 'group',
    }

    const response = await request(app.getHttpServer())
      .post(routes.create())
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .send(payload)
      .expect(201)

    return response.body.id as string
  }

  const setStatus = (id: string, status: protocol.CourseDetails['status']) =>
    request(app.getHttpServer())
      .patch(routes.update(id))
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .send({ status })

  it('starts a course created through the API as a draft', async () => {
    const id = await create()

    const response = await request(app.getHttpServer())
      .get(routes.get(id))
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .expect(200)

    expect((response.body as protocol.GetCourseResponse).status).toBe('draft')
  })

  it('publishes a draft on update', async () => {
    const id = await create()

    const response = await setStatus(id, 'published').expect(200)

    expect((response.body as protocol.UpdateCourseResponse).status).toBe('published')
  })

  it('takes a published course back out of sight on a further update', async () => {
    const id = await create()
    await setStatus(id, 'published').expect(200)

    const response = await setStatus(id, 'draft').expect(200)

    expect((response.body as protocol.UpdateCourseResponse).status).toBe('draft')
  })

  it('keeps the status it was last given when the course is read back', async () => {
    const id = await create()
    await setStatus(id, 'published').expect(200)

    const response = await request(app.getHttpServer())
      .get(routes.get(id))
      .auth(ctx.one.tokens.admin, { type: 'bearer' })
      .expect(200)

    expect((response.body as protocol.GetCourseResponse).status).toBe('published')
  })
})
