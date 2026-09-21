import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { CoursesService, LessonsService, LessonVersionsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { mediaPath, UploadGrant } from '@vidya/domain'
import { AuditLog } from '@vidya/entities'
import { LessonContent, MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { refusalFor, TEST_MASTER_KEY } from './context'
import { createMediaFlow, MediaFlow } from './uploadFlow'

const ROUTE = 'DELETE /media/:id'

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

type Stored = { mediaId: domain.MediaId; grant: UploadGrant }

describe('deleting a file from a school library', () => {
  let app: INestApplication
  let flow: MediaFlow
  let versions: LessonVersionsService
  let dataSource: DataSource
  let schoolId: domain.SchoolId
  let courseId: domain.CourseId

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
    versions = app.get(LessonVersionsService)
    dataSource = app.get(DataSource)
    schoolId = flow.ctx.one.school.id as domain.SchoolId

    await flow.configureStorage(schoolId, flow.ctx.one.users.owner)

    courseId = (
      await app.get(CoursesService).create({
        name: 'Bhakti-shastri',
        learningType: 'group',
        schoolId,
      })
    ).id
  })

  afterEach(async () => {
    await app.close()
  })

  const store = async (): Promise<Stored> => {
    const asked = await flow.askUpload(
      flow.imageUpload(schoolId, { sizeBytes: 2048, sha256: undefined }),
      flow.ctx.one.users.owner,
    )

    expect(asked.status).toBe(201)
    const grant = asked.body.grant as UploadGrant
    await flow.putBytes(grant, Buffer.alloc(2048, 6))

    const completed = await flow.completeUpload(asked.body.mediaId, {}, flow.ctx.one.users.owner)
    expect(completed.status).toBe(200)

    return { mediaId: asked.body.mediaId as domain.MediaId, grant }
  }

  /** A lesson whose current draft points at the given files. */
  const lessonUsing = async (
    title: string,
    lessonNumber: number,
    ids: domain.MediaId[],
  ): Promise<domain.LessonId> => {
    const lesson = await app.get(LessonsService).create({
      courseId,
      schoolId,
      lessonNumber,
      title,
    })

    const draft = await versions.createInitialDraft(lesson.id)
    await versions.saveDraft(lesson.id, draft.id, contentWith(ids.map(mediaPath)))

    return lesson.id
  }

  const remove = async (mediaId: string) =>
    request(app.getHttpServer())
      .delete(Routes().media.delete(mediaId))
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner))

  const usage = async () =>
    (await flow.usageOf(schoolId, flow.ctx.one.users.owner)).body as { usedBytes: number }

  const deletionEntries = async (): Promise<AuditLog[]> =>
    (await dataSource.getRepository(AuditLog).find()).filter(
      (row) => (row.action as string) === 'media.deleted',
    )

  /* -------------------------------------------------------------------------- */
  /*                             While it is in use                             */
  /* -------------------------------------------------------------------------- */

  it('refuses to delete a file a lesson version still points at', async () => {
    const expected = refusalFor(ROUTE, MediaRefusals.inUse)
    const stored = await store()
    await lessonUsing('Lesson 4. Practice', 4, [stored.mediaId])

    const response = await remove(stored.mediaId)

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toEqual([MediaRefusals.inUse])
  })

  it('names every lesson that still points at the file it refused to delete', async () => {
    const stored = await store()
    const first = await lessonUsing('Lesson 4. Practice', 4, [stored.mediaId])
    const second = await lessonUsing('Lesson 5. Revision', 5, [stored.mediaId])

    const response = await remove(stored.mediaId)

    expect(response.body.lessons).toHaveLength(2)
    expect(response.body.lessons).toEqual(
      expect.arrayContaining([
        { lessonId: first, title: 'Lesson 4. Practice' },
        { lessonId: second, title: 'Lesson 5. Revision' },
      ]),
    )
  })

  it('keeps the object and the row when the deletion was refused', async () => {
    const stored = await store()
    await lessonUsing('Lesson 4. Practice', 4, [stored.mediaId])

    const response = await remove(stored.mediaId)

    expect(response.body.message).toEqual([MediaRefusals.inUse])
    expect(flow.objectBehind(stored.grant)).toBeDefined()
    expect((await flow.mediaRow(stored.mediaId))?.status).toBe('ready')
    expect((await usage()).usedBytes).toBe(2048)
  })

  it('lets go of a file once the block that used it was deleted from the content', async () => {
    const stored = await store()
    const lesson = await lessonUsing('Lesson 4. Practice', 4, [stored.mediaId])
    const [draft] = await versions.findAll({ where: { lessonId: lesson } })

    await versions.saveDraft(lesson, draft.id, contentWith([]))

    expect((await remove(stored.mediaId)).status).toBe(200)
  })

  /* -------------------------------------------------------------------------- */
  /*                            While nothing uses it                           */
  /* -------------------------------------------------------------------------- */

  it('takes the object out of storage', async () => {
    const stored = await store()

    const response = await remove(stored.mediaId)

    expect(response.status).toBe(200)
    expect(flow.removalsOf(flow.keyBehind(stored.grant))).toBe(1)
    expect(flow.objectBehind(stored.grant)).toBeUndefined()
  })

  it('takes the row with it and gives the bytes back to the school', async () => {
    const stored = await store()
    expect((await usage()).usedBytes).toBe(2048)

    await remove(stored.mediaId)

    expect(await flow.mediaRow(stored.mediaId)).toBeUndefined()
    expect((await usage()).usedBytes).toBe(0)
  })

  it('leaves the files it was not asked about alone', async () => {
    const kept = await store()
    const dropped = await store()

    await remove(dropped.mediaId)

    expect(await flow.mediaRow(kept.mediaId)).toBeDefined()
    expect((await usage()).usedBytes).toBe(2048)
  })

  it('records who deleted the file in the audit trail', async () => {
    const stored = await store()

    await remove(stored.mediaId)

    const [entry, ...rest] = await deletionEntries()

    expect(rest).toHaveLength(0)
    expect(entry).toMatchObject({
      subjectId: stored.mediaId,
      schoolId,
      actorUserId: flow.ctx.one.users.owner.id,
    })
  })

  it('writes no deletion to the audit trail when it refused to delete', async () => {
    const stored = await store()
    await lessonUsing('Lesson 4. Practice', 4, [stored.mediaId])

    const response = await remove(stored.mediaId)

    expect(response.body.message).toEqual([MediaRefusals.inUse])
    expect(await deletionEntries()).toEqual([])
  })
})
