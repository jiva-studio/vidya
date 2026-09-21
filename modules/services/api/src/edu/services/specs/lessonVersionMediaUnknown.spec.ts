import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { CoursesService, LessonsService, LessonVersionsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { refusalFor, TEST_MASTER_KEY } from '@vidya/api/media/controllers/specs/context'
import { createMediaFlow, MediaFlow } from '@vidya/api/media/controllers/specs/uploadFlow'
import * as domain from '@vidya/domain'
import { mediaPath } from '@vidya/domain'
import { User } from '@vidya/entities'
import { LessonContent, MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

const ROUTE = 'PUT /edu/lessons/:lessonId/versions/:versionId'

const blockId = () => domain.asId<domain.BlockId>(faker.string.uuid())
const sectionId = () => domain.asId<domain.SectionId>(faker.string.uuid())

const contentWith = (urls: string[]): LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [
    {
      id: sectionId(),
      title: 'Illustrations',
      assessment: 'none',
      blocks: urls.map((url) => ({
        id: blockId(),
        type: 'image' as const,
        source: 'upload' as const,
        url,
      })),
    },
  ],
})

const urlsIn = (content: LessonContent): string[] =>
  content.sections.flatMap((section) =>
    section.blocks.flatMap((block) => ('url' in block ? [block.url] : [])),
  )

describe('a lesson version that points outside its own library', () => {
  let app: INestApplication
  let flow: MediaFlow
  let versions: LessonVersionsService
  let dataSource: DataSource
  let schoolId: domain.SchoolId
  let lessonId: domain.LessonId
  let draftId: domain.LessonVersionId
  let ownFile: domain.MediaId

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
    versions = app.get(LessonVersionsService)
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
    draftId = (await versions.createInitialDraft(lessonId)).id
    ownFile = await storeImage(schoolId, flow.ctx.one.users.owner)

    await versions.saveDraft(lessonId, draftId, contentWith([mediaPath(ownFile)]))
  })

  afterEach(async () => {
    await app.close()
  })

  async function storeImage(school: string, user: User): Promise<domain.MediaId> {
    const asked = await flow.askUpload(
      flow.imageUpload(school, { sizeBytes: 2048, sha256: undefined }),
      user,
    )

    expect(asked.status).toBe(201)
    await flow.putBytes(asked.body.grant, Buffer.alloc(2048, 8))

    const completed = await flow.completeUpload(asked.body.mediaId, {}, user)
    expect(completed.status).toBe(200)

    return asked.body.mediaId as domain.MediaId
  }

  const save = async (content: LessonContent) =>
    request(app.getHttpServer())
      .patch(Routes().edu.lessons.versions.update(lessonId, draftId))
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner))
      .send({ content })

  const storedContent = async (): Promise<LessonContent> => {
    const rows: { content: LessonContent }[] = await dataSource.query(
      'SELECT "content" FROM "lesson_versions" WHERE "id" = $1',
      [draftId],
    )

    return rows[0].content
  }

  const usedFiles = async (): Promise<string[]> => {
    const rows: { mediaId: string }[] = await dataSource.query(
      'SELECT "mediaId" FROM "media_usages" WHERE "lessonVersionId" = $1',
      [draftId],
    )

    return rows.map((row) => row.mediaId).sort()
  }

  /** A file of the school next door, which is as unknown here as one that never existed. */
  const fileOfAnotherSchool = async (): Promise<domain.MediaId> => {
    const other = flow.ctx.two.school.id
    await flow.configureStorage(other, flow.ctx.two.users.technician)

    return storeImage(other, flow.ctx.two.users.technician)
  }

  it('refuses a save naming a file no record answers for', async () => {
    const expected = refusalFor(ROUTE, MediaRefusals.unknownMedia)

    const response = await save(contentWith([mediaPath(domain.asId(faker.string.uuid()))]))

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toEqual([MediaRefusals.unknownMedia])
  })

  it('refuses a save naming a file that belongs to another school', async () => {
    const expected = refusalFor(ROUTE, MediaRefusals.unknownMedia)
    const theirs = await fileOfAnotherSchool()

    const response = await save(contentWith([mediaPath(theirs)]))

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toEqual([MediaRefusals.unknownMedia])
  })

  it('keeps the content it had when it refused the save', async () => {
    await save(contentWith([mediaPath(domain.asId(faker.string.uuid()))]))

    expect(urlsIn(await storedContent())).toEqual([mediaPath(ownFile)])
  })

  it('records no use of the file it refused', async () => {
    const theirs = await fileOfAnotherSchool()

    await save(contentWith([mediaPath(theirs)]))

    expect(await usedFiles()).toEqual([ownFile])
  })

  it('refuses the same save when it arrives through the service rather than a request', async () => {
    // Sync reaches the same transition, so the rule cannot live in the controller.
    await expect(
      versions.saveDraft(
        lessonId,
        draftId,
        contentWith([mediaPath(domain.asId(faker.string.uuid()))]),
      ),
    ).rejects.toThrow()
  })
})
