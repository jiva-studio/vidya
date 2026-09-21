import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { CoursesService, LessonsService, LessonVersionsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { TEST_MASTER_KEY } from '@vidya/api/media/controllers/specs/context'
import { createMediaFlow, MediaFlow } from '@vidya/api/media/controllers/specs/uploadFlow'
import { testDatabase } from '@vidya/api/shared/datasources'
import * as domain from '@vidya/domain'
import { mediaPath } from '@vidya/domain'
import { LessonContent } from '@vidya/protocol'
import { DataSource } from 'typeorm'

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

/**
 * What only a real Postgres can prove about a refused save.
 *
 * pg-mem does not undo the inserts a failed statement was preceded by, so
 * under it a recount that escaped the version's transaction reads exactly the
 * same as one that never left it.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

describeOnPostgres('a save refused halfway through its files', () => {
  let app: INestApplication
  let flow: MediaFlow
  let versions: LessonVersionsService
  let dataSource: DataSource
  let schoolId: domain.SchoolId
  let lessonId: domain.LessonId
  let draftId: domain.LessonVersionId
  let known: domain.MediaId

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

    const asked = await flow.askUpload(
      flow.imageUpload(schoolId, { sizeBytes: 2048, sha256: undefined }),
      flow.ctx.one.users.owner,
    )
    expect(asked.status).toBe(201)

    await flow.putBytes(asked.body.grant, Buffer.alloc(2048, 8))
    expect(
      (await flow.completeUpload(asked.body.mediaId, {}, flow.ctx.one.users.owner)).status,
    ).toBe(200)

    known = asked.body.mediaId as domain.MediaId
  })

  afterEach(async () => {
    await app.close()
  })

  const countOf = async (table: string): Promise<number> => {
    const rows: { count: string }[] = await dataSource.query(`SELECT COUNT(*) FROM "${table}"`)

    return Number(rows[0].count)
  }

  const saveBothBlocks = async (): Promise<void> => {
    await versions.saveDraft(
      lessonId,
      draftId,
      contentWith([mediaPath(known), mediaPath(domain.asId(faker.string.uuid()))]),
    )
  }

  it('leaves behind neither the version it was writing nor the use it had already recorded', async () => {
    const versionsBefore = await countOf('lesson_versions')

    // The valid block comes first on purpose: a recount outside the version's
    // transaction gets its row in before the unknown one refuses the save.
    await expect(saveBothBlocks()).rejects.toThrow()

    expect(await countOf('lesson_versions')).toBe(versionsBefore)
    expect(await countOf('media_usages')).toBe(0)
  })

  it('leaves the draft with the content it had before the refusal', async () => {
    await expect(saveBothBlocks()).rejects.toThrow()

    const rows: { content: LessonContent }[] = await dataSource.query(
      'SELECT "content" FROM "lesson_versions" WHERE "id" = $1',
      [draftId],
    )

    expect(rows[0].content.sections).toEqual([])
  })
})
