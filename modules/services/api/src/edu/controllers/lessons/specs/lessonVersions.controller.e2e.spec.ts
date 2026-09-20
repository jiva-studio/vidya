import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

describe('/edu/lessons/:lessonId/versions', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const routes = protocol.Routes().edu.lessons.versions

  const content = (title: string): protocol.LessonContent => ({
    schemaVersion: 1,
    sections: [
      {
        id: domain.asId<domain.SectionId>('11111111-1111-4111-8111-111111111111'),
        title,
        assessment: 'teacher',
        blocks: [
          {
            id: domain.asId<domain.BlockId>('22222222-2222-4222-8222-222222222222'),
            type: 'text',
            content: 'Read this',
          },
        ],
      },
    ],
  })

  const publish = (versionId: string, token: string) =>
    request(app.getHttpServer())
      .post(routes.publish(ctx.lessonId, versionId))
      .auth(token, { type: 'bearer' })

  /* -------------------------------------------------------------------------- */
  /*                                   Editing                                  */
  /* -------------------------------------------------------------------------- */

  it('saves content into a draft', async () => {
    const response = await request(app.getHttpServer())
      .patch(routes.update(ctx.lessonId, ctx.draftVersionId))
      .auth(ctx.tokens.editor, { type: 'bearer' })
      .send({ content: content('Introduction') })
      .expect(200)

    expect(response.body.content.sections[0].title).toBe('Introduction')
  })

  it('refuses to edit content with read-only permissions', () => {
    return request(app.getHttpServer())
      .patch(routes.update(ctx.lessonId, ctx.draftVersionId))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .send({ content: content('Nope') })
      .expect(403)
  })

  it('does not reach a lesson belonging to another school', () => {
    return request(app.getHttpServer())
      .get(routes.all(ctx.lessonId))
      .auth(ctx.tokens.otherSchool, { type: 'bearer' })
      .expect(404)
  })

  /* -------------------------------------------------------------------------- */
  /*                                 Publishing                                 */
  /* -------------------------------------------------------------------------- */

  it('requires a separate permission to publish', () => {
    // Editing a draft and freezing what students work against are different authorities.
    return publish(ctx.draftVersionId, ctx.tokens.editor).expect(403)
  })

  it('publishes a draft', async () => {
    const response = await publish(ctx.draftVersionId, ctx.tokens.publisher).expect(201)

    expect(response.body.status).toBe('published')
    expect(response.body.publishedAt).toBeDefined()
  })

  it('freezes content once published', async () => {
    await publish(ctx.draftVersionId, ctx.tokens.publisher).expect(201)

    // Homework points at this version; editing it would change an answered question.
    return request(app.getHttpServer())
      .patch(routes.update(ctx.lessonId, ctx.draftVersionId))
      .auth(ctx.tokens.editor, { type: 'bearer' })
      .send({ content: content('Rewritten') })
      .expect(409)
  })

  it('refuses to publish the same version twice', async () => {
    await publish(ctx.draftVersionId, ctx.tokens.publisher).expect(201)

    return publish(ctx.draftVersionId, ctx.tokens.publisher).expect(409)
  })

  /* -------------------------------------------------------------------------- */
  /*                                 New drafts                                 */
  /* -------------------------------------------------------------------------- */

  it('refuses a second open draft', () => {
    return request(app.getHttpServer())
      .post(routes.create(ctx.lessonId))
      .auth(ctx.tokens.editor, { type: 'bearer' })
      .expect(409)
  })

  it('starts a new draft from the published content, not from empty', async () => {
    await request(app.getHttpServer())
      .patch(routes.update(ctx.lessonId, ctx.draftVersionId))
      .auth(ctx.tokens.editor, { type: 'bearer' })
      .send({ content: content('Published text') })
      .expect(200)

    await publish(ctx.draftVersionId, ctx.tokens.publisher).expect(201)

    const created = await request(app.getHttpServer())
      .post(routes.create(ctx.lessonId))
      .auth(ctx.tokens.editor, { type: 'bearer' })
      .expect(201)

    expect(created.body.version).toBe(2)

    const draft = await request(app.getHttpServer())
      .get(routes.get(ctx.lessonId, created.body.id))
      .auth(ctx.tokens.reader, { type: 'bearer' })
      .expect(200)

    expect(draft.body.content.sections[0].title).toBe('Published text')
    expect(draft.body.status).toBe('draft')
  })
})
