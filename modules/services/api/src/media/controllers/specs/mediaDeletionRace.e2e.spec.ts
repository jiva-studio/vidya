import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { CoursesService, LessonsService, LessonVersionsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { InMemoryStorage } from '@vidya/api/media/infra'
import { MediaRowsService, MediaUsageIndexService } from '@vidya/api/media/services'
import * as domain from '@vidya/domain'
import { MediaStoragePort, UploadGrant } from '@vidya/domain'
import { MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { refusalFor, TEST_MASTER_KEY } from './context'
import { createMediaFlow, MediaFlow } from './uploadFlow'

const ROUTE = 'DELETE /media/:id'

describe('a deletion that a lesson save overtakes', () => {
  let app: INestApplication
  let flow: MediaFlow
  let dataSource: DataSource
  let schoolId: domain.SchoolId
  let versionId: domain.LessonVersionId
  let stored: { mediaId: domain.MediaId; grant: UploadGrant }

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
      lessonNumber: 4,
      title: 'Lesson 4. Practice',
    })

    versionId = (await app.get(LessonVersionsService).createInitialDraft(lesson.id)).id

    const asked = await flow.askUpload(
      flow.imageUpload(schoolId, { sizeBytes: 2048, sha256: undefined }),
      flow.ctx.one.users.owner,
    )
    expect(asked.status).toBe(201)

    const grant = asked.body.grant as UploadGrant
    await flow.putBytes(grant, Buffer.alloc(2048, 6))
    expect(
      (await flow.completeUpload(asked.body.mediaId, {}, flow.ctx.one.users.owner)).status,
    ).toBe(200)

    stored = { mediaId: asked.body.mediaId as domain.MediaId, grant }
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await app.close()
  })

  const remove = async (mediaId: string) =>
    request(app.getHttpServer())
      .delete(Routes().media.delete(mediaId))
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner))

  const usedBytes = async (): Promise<number> =>
    ((await flow.usageOf(schoolId, flow.ctx.one.users.owner)).body as { usedBytes: number })
      .usedBytes

  /**
   * A lesson version that starts naming the file after the deletion has looked
   * and before it acts — which is what a save committing in that window does.
   */
  const claimFileAfterTheCheck = (): void => {
    const usages = app.get(MediaUsageIndexService)
    const answer = usages.lessonsUsing.bind(usages)

    jest.spyOn(usages, 'lessonsUsing').mockImplementation(async (mediaId) => {
      const lessons = await answer(mediaId)

      await dataSource.query(
        'INSERT INTO "media_usages" ("id", "mediaId", "lessonVersionId", "schoolId", "createdAt")' +
          ' VALUES ($1, $2, $3, $4, now())',
        [faker.string.uuid(), mediaId, versionId, schoolId],
      )

      return lessons
    })
  }

  it('refuses the deletion of a file a lesson claimed while it was running', async () => {
    const expected = refusalFor(ROUTE, MediaRefusals.inUse)
    claimFileAfterTheCheck()

    const response = await remove(stored.mediaId)

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toEqual([MediaRefusals.inUse])
  })

  it('leaves the object in storage when a lesson claimed the file mid-deletion', async () => {
    claimFileAfterTheCheck()

    await remove(stored.mediaId)

    expect(flow.objectBehind(stored.grant)).toBeDefined()
    expect((await flow.mediaRow(stored.mediaId))?.status).toBe('ready')
  })

  it('never leaves the school charged for a file whose object is gone', async () => {
    jest
      .spyOn(app.get(MediaRowsService), 'deleteRow')
      .mockRejectedValue(new Error('the row could not be dropped'))

    await remove(stored.mediaId)

    expect((await flow.mediaRow(stored.mediaId))?.status).not.toBe('ready')
    expect(await usedBytes()).toBe(0)
  })

  it('archives the row of a file whose object it could not take out', async () => {
    const storages = app.get(InMemoryStorage)
    const openStorage = storages.openStorage.bind(storages)

    jest.spyOn(storages, 'openStorage').mockImplementation((credentials) => {
      const opened = openStorage(credentials)

      return {
        ...opened,
        remove: async (): Promise<never> => {
          throw new Error('the object could not be taken out')
        },
      } as MediaStoragePort
    })

    await remove(stored.mediaId)

    const row = await flow.mediaRow(stored.mediaId)
    expect(row?.status).toBe('archived')
    expect(row?.archivedAt).not.toBeNull()
    expect(await usedBytes()).toBe(0)
  })
})
