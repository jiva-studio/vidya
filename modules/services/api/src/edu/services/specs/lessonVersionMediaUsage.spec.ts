import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { CoursesService, LessonsService, LessonVersionsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { TEST_MASTER_KEY } from '@vidya/api/media/controllers/specs/context'
import { createMediaFlow, MediaFlow } from '@vidya/api/media/controllers/specs/uploadFlow'
import * as domain from '@vidya/domain'
import { mediaPath } from '@vidya/domain'
import { LessonContent } from '@vidya/protocol'
import { DataSource } from 'typeorm'

type UsageRow = {
  id: string
  mediaId: string
  lessonVersionId: string
  schoolId: string
}

const blockId = () => domain.asId<domain.BlockId>(faker.string.uuid())
const sectionId = () => domain.asId<domain.SectionId>(faker.string.uuid())

/** One section holding an image block per address, so a save has media to find. */
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

describe('what a saved lesson version records about the files it uses', () => {
  let app: INestApplication
  let flow: MediaFlow
  let versions: LessonVersionsService
  let dataSource: DataSource
  let lessonId: domain.LessonId
  let draftId: domain.LessonVersionId
  let schoolId: domain.SchoolId

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
  })

  afterEach(async () => {
    await app.close()
  })

  /** A file uploaded the way the browser does, left ready for a block to point at. */
  const storeImage = async (): Promise<domain.MediaId> => {
    const asked = await flow.askUpload(
      flow.imageUpload(schoolId, { sizeBytes: 2048, sha256: undefined }),
      flow.ctx.one.users.owner,
    )

    expect(asked.status).toBe(201)
    await flow.putBytes(asked.body.grant, Buffer.alloc(2048, 9))

    const completed = await flow.completeUpload(asked.body.mediaId, {}, flow.ctx.one.users.owner)
    expect(completed.status).toBe(200)

    return asked.body.mediaId as domain.MediaId
  }

  const usagesOf = async (versionId: string): Promise<UsageRow[]> =>
    dataSource.query('SELECT * FROM "media_usages" WHERE "lessonVersionId" = $1', [versionId])

  const mediaIdsUsedBy = async (versionId: string): Promise<string[]> =>
    (await usagesOf(versionId)).map((row) => row.mediaId).sort()

  it('records one usage row for every file the saved content points at', async () => {
    const first = await storeImage()
    const second = await storeImage()

    await versions.saveDraft(lessonId, draftId, contentWith([mediaPath(first), mediaPath(second)]))

    expect(await mediaIdsUsedBy(draftId)).toEqual([first, second].sort())
  })

  it('drops the usage row of a file whose block was deleted from the content', async () => {
    const kept = await storeImage()
    const removed = await storeImage()

    await versions.saveDraft(lessonId, draftId, contentWith([mediaPath(kept), mediaPath(removed)]))
    await versions.saveDraft(lessonId, draftId, contentWith([mediaPath(kept)]))

    expect(await mediaIdsUsedBy(draftId)).toEqual([kept])
  })

  it('records a file used by two blocks of one version only once', async () => {
    const reused = await storeImage()

    await versions.saveDraft(lessonId, draftId, contentWith([mediaPath(reused), mediaPath(reused)]))

    expect(await usagesOf(draftId)).toHaveLength(1)
  })

  it('records nothing for a block that points at an address outside the library', async () => {
    const stored = await storeImage()

    await versions.saveDraft(
      lessonId,
      draftId,
      contentWith([mediaPath(stored), 'https://cdn.example/poster.png', '/media/../secrets']),
    )

    expect(await mediaIdsUsedBy(draftId)).toEqual([stored])
  })

  it('names the school the lesson belongs to on every usage row it writes', async () => {
    const stored = await storeImage()

    await versions.saveDraft(lessonId, draftId, contentWith([mediaPath(stored)]))

    expect((await usagesOf(draftId)).map((row) => row.schoolId)).toEqual([schoolId])
  })

  it('carries the files forward when a revision is opened from published content', async () => {
    const stored = await storeImage()

    await versions.saveDraft(lessonId, draftId, contentWith([mediaPath(stored)]))
    await versions.publish(lessonId, draftId)
    const revision = await versions.openDraft(lessonId)

    expect(await mediaIdsUsedBy(revision.id)).toEqual([stored])
  })

  it('leaves the usage rows alone when the save itself is refused', async () => {
    const stored = await storeImage()
    const other = await storeImage()

    await versions.saveDraft(lessonId, draftId, contentWith([mediaPath(stored)]))
    await versions.publish(lessonId, draftId)

    // Published content is frozen: the refusal must take the usage rows with it,
    // or the recount has escaped the transaction that writes the version.
    await expect(
      versions.saveDraft(lessonId, draftId, contentWith([mediaPath(other)])),
    ).rejects.toThrow()

    expect(await mediaIdsUsedBy(draftId)).toEqual([stored])
  })
})
