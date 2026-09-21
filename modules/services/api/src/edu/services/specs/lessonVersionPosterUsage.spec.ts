import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { CoursesService, LessonsService, LessonVersionsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { refusalFor, TEST_MASTER_KEY } from '@vidya/api/media/controllers/specs/context'
import { createMediaFlow, MediaFlow } from '@vidya/api/media/controllers/specs/uploadFlow'
import * as domain from '@vidya/domain'
import { mediaPath, UploadGrant } from '@vidya/domain'
import { User } from '@vidya/entities'
import { LessonContent, MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'

const SAVE_ROUTE = 'PUT /edu/lessons/:lessonId/versions/:versionId'
const DELETE_ROUTE = 'DELETE /media/:id'

/** A video hosted elsewhere, so only the poster is a file of this library. */
const EMBEDDED_VIDEO = 'https://www.youtube.com/watch?v=Bhakti'

const posterContent = (posterUrl: string): LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [
    {
      id: domain.asId<domain.SectionId>(faker.string.uuid()),
      title: 'Watch',
      assessment: 'none',
      blocks: [
        {
          id: domain.asId<domain.BlockId>(faker.string.uuid()),
          type: 'video',
          source: 'youtube',
          url: EMBEDDED_VIDEO,
          posterUrl,
        },
      ],
    },
  ],
})

describe('the poster a video block shows', () => {
  let app: INestApplication
  let flow: MediaFlow
  let versions: LessonVersionsService
  let schoolId: domain.SchoolId
  let lessonId: domain.LessonId
  let draftId: domain.LessonVersionId

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
    versions = app.get(LessonVersionsService)
    schoolId = flow.ctx.one.school.id as domain.SchoolId

    await flow.configureStorage(schoolId, flow.ctx.one.users.owner)

    const course = await app.get(CoursesService).create({
      name: 'Bhakti-shastri',
      learningType: 'group',
      schoolId,
    })

    const lesson = await app.get(LessonsService).create({
      courseId: course.id,
      schoolId,
      lessonNumber: 1,
      title: 'Lesson 1. The illustrated one',
    })

    lessonId = lesson.id
    draftId = (await versions.createInitialDraft(lessonId)).id
  })

  afterEach(async () => {
    await app.close()
  })

  const storeImage = async (
    school: string,
    user: User,
  ): Promise<{ mediaId: domain.MediaId; grant: UploadGrant }> => {
    const asked = await flow.askUpload(
      flow.imageUpload(school, { sizeBytes: 2048, sha256: undefined }),
      user,
    )

    expect(asked.status).toBe(201)
    const grant = asked.body.grant as UploadGrant
    await flow.putBytes(grant, Buffer.alloc(2048, 8))
    expect((await flow.completeUpload(asked.body.mediaId, {}, user)).status).toBe(200)

    return { mediaId: asked.body.mediaId as domain.MediaId, grant }
  }

  const save = async (content: LessonContent) =>
    request(app.getHttpServer())
      .patch(Routes().edu.lessons.versions.update(lessonId, draftId))
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner))
      .send({ content })

  const remove = async (mediaId: string) =>
    request(app.getHttpServer())
      .delete(Routes().media.delete(mediaId))
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner))

  it('refuses a save whose poster names a file of another school', async () => {
    const expected = refusalFor(SAVE_ROUTE, MediaRefusals.unknownMedia)
    const other = flow.ctx.two.school.id
    await flow.configureStorage(other, flow.ctx.two.users.technician)
    const theirs = await storeImage(other, flow.ctx.two.users.technician)

    const response = await save(posterContent(mediaPath(theirs.mediaId)))

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toEqual([MediaRefusals.unknownMedia])
  })

  it('refuses a save whose poster names no file at all', async () => {
    const expected = refusalFor(SAVE_ROUTE, MediaRefusals.unknownMedia)

    const response = await save(posterContent(mediaPath(domain.asId(faker.string.uuid()))))

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toEqual([MediaRefusals.unknownMedia])
  })

  it('refuses to delete the file a published lesson shows as its poster', async () => {
    const expected = refusalFor(DELETE_ROUTE, MediaRefusals.inUse)
    const poster = await storeImage(schoolId, flow.ctx.one.users.owner)

    await versions.saveDraft(lessonId, draftId, posterContent(mediaPath(poster.mediaId)))
    await versions.publish(lessonId, draftId)

    const response = await remove(poster.mediaId)

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toEqual([MediaRefusals.inUse])
  })

  it('leaves the published poster where the students can still see it', async () => {
    const poster = await storeImage(schoolId, flow.ctx.one.users.owner)

    await versions.saveDraft(lessonId, draftId, posterContent(mediaPath(poster.mediaId)))
    await versions.publish(lessonId, draftId)
    await remove(poster.mediaId)

    expect(flow.objectBehind(poster.grant)).toBeDefined()
    expect((await flow.mediaRow(poster.mediaId))?.status).toBe('ready')
  })
})
