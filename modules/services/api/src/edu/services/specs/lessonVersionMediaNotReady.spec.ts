import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { CoursesService, LessonsService, LessonVersionsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { TEST_MASTER_KEY } from '@vidya/api/media/controllers/specs/context'
import { createMediaFlow, MediaFlow } from '@vidya/api/media/controllers/specs/uploadFlow'
import * as domain from '@vidya/domain'
import { mediaPath } from '@vidya/domain'
import { LessonContent, MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

const contentWith = (urls: string[]): LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [
    {
      id: domain.asId<domain.SectionId>(faker.string.uuid()),
      title: 'Illustrations',
      assessment: 'none',
      blocks: urls.map((url) => ({
        id: domain.asId<domain.BlockId>(faker.string.uuid()),
        type: 'image' as const,
        source: 'upload' as const,
        url,
      })),
    },
  ],
})

describe('a lesson version naming a file whose bytes never landed', () => {
  let app: INestApplication
  let flow: MediaFlow
  let dataSource: DataSource
  let schoolId: domain.SchoolId
  let lessonId: domain.LessonId
  let draftId: domain.LessonVersionId

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
    dataSource = app.get(DataSource)
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
    draftId = (await app.get(LessonVersionsService).createInitialDraft(lessonId)).id
  })

  afterEach(async () => {
    await app.close()
  })

  /** A grant taken and never completed, which is what an upload still running looks like. */
  const grantedButNotLanded = async (): Promise<domain.MediaId> => {
    const asked = await flow.askUpload(
      flow.imageUpload(schoolId, { sizeBytes: 2048, sha256: undefined }),
      flow.ctx.one.users.owner,
    )

    expect(asked.status).toBe(201)

    return asked.body.mediaId as domain.MediaId
  }

  const markFailed = async (mediaId: domain.MediaId): Promise<void> => {
    await dataSource.query('UPDATE "media" SET "status" = $2 WHERE "id" = $1', [mediaId, 'failed'])
  }

  const save = async (content: LessonContent) =>
    request(app.getHttpServer())
      .patch(Routes().edu.lessons.versions.update(lessonId, draftId))
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner))
      .send({ content })

  const usedFiles = async (): Promise<string[]> => {
    const rows: { mediaId: string }[] = await dataSource.query(
      'SELECT "mediaId" FROM "media_usages" WHERE "lessonVersionId" = $1',
      [draftId],
    )

    return rows.map((row) => row.mediaId)
  }

  it('refuses the save while the file is still being uploaded', async () => {
    const waiting = await grantedButNotLanded()

    const response = await save(contentWith([mediaPath(waiting)]))

    expect(response.status).toBe(409)
    expect(response.body.message).toEqual([MediaRefusals.notReady])
  })

  it('refuses the save naming a file whose upload was turned down', async () => {
    const waiting = await grantedButNotLanded()
    await markFailed(waiting)

    const response = await save(contentWith([mediaPath(waiting)]))

    expect(response.status).toBe(422)
    expect(response.body.message).toEqual([MediaRefusals.unknownMedia])
  })

  it('records no use of a file it refused for not being ready', async () => {
    const waiting = await grantedButNotLanded()

    await save(contentWith([mediaPath(waiting)]))

    expect(await usedFiles()).toEqual([])
  })
})
