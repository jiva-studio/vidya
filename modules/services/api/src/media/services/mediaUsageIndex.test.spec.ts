import { testingDataSource } from '@vidya/api/shared/datasources'
import { LessonId, LessonVersionId, MediaId, SchoolId, StorageProfileId } from '@vidya/domain'
import * as domain from '@vidya/domain'
import {
  Course,
  Lesson,
  LessonVersion,
  Media,
  MediaUsage,
  School,
  StorageProfile,
  User,
} from '@vidya/entities'
import { randomUUID } from 'crypto'
import { DataSource } from 'typeorm'

import { MediaUsageIndexService } from './mediaUsageIndex.service'

describe('the index of files lesson content points at', () => {
  let ds: DataSource
  let index: MediaUsageIndexService
  let schoolId: SchoolId
  let otherSchoolId: SchoolId
  let profileId: StorageProfileId
  let userId: string
  let lessonId: LessonId

  const storedFile = async (school: SchoolId = schoolId): Promise<MediaId> => {
    const media = await ds.getRepository(Media).save({
      schoolId: school,
      profileId,
      kind: 'image',
      status: 'ready',
      storageKey: `school/${school}/image/${randomUUID()}/original.png`,
      name: 'cover.png',
      mimeType: 'image/png',
      sizeBytes: '2048',
      createdBy: userId,
    } as unknown as Media)

    return media.id
  }

  const versionOf = async (lesson: LessonId, version: number): Promise<LessonVersionId> => {
    const stored = await ds.getRepository(LessonVersion).save({
      lessonId: lesson,
      version,
      status: 'draft',
      content: domain.emptyLessonContent(),
    } as LessonVersion)

    return stored.id
  }

  const lessonNamed = async (title: string, lessonNumber: number): Promise<LessonId> => {
    const course = await ds
      .getRepository(Course)
      .save({ name: 'Bhakti-shastri', learningType: 'group', schoolId } as Course)

    const lesson = await ds
      .getRepository(Lesson)
      .save({ courseId: course.id, schoolId, lessonNumber, title } as Lesson)

    return lesson.id
  }

  const rowsFor = async (versionId: LessonVersionId): Promise<MediaUsage[]> =>
    ds.getRepository(MediaUsage).find({ where: { lessonVersionId: versionId } })

  beforeEach(async () => {
    ds = await testingDataSource()
    index = new MediaUsageIndexService(ds)

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    schoolId = school.id

    const next = await ds.getRepository(School).save({ name: 'Two', config: {} } as School)
    otherSchoolId = next.id

    const user = await ds.getRepository(User).save({ email: 'one@example.com' } as User)
    userId = user.id

    const profile = await ds.getRepository(StorageProfile).save({
      schoolId,
      provider: 's3-compatible',
      endpoint: 'https://de-s3.storage.bunnycdn.com',
      r2AccountId: null,
      region: 'de',
      bucket: 'vidya-demo',
      prefix: `school/${schoolId}`,
      accessKeyId: 'vidya-demo',
      secrets: {
        keyVersion: 1,
        dek: { ciphertext: 'c2VhbGVkLWRlaw==', nonce: 'ZGVrLW5vbmNl' },
        secret: { ciphertext: 'c2VhbGVk', nonce: 'bm9uY2U=' },
        tokenSecret: null,
      },
      delivery: 'presigned',
      publicBaseUrl: null,
      verifiedAt: new Date('2026-09-21T12:00:00.000Z'),
      verifyError: null,
      retiredAt: null,
    } as unknown as StorageProfile)
    profileId = profile.id

    lessonId = await lessonNamed('Lesson 1. The illustrated one', 1)
  })

  afterEach(async () => {
    await ds.destroy()
  })

  it('writes one row for a file handed to it twice', async () => {
    const file = await storedFile()
    const versionId = await versionOf(lessonId, 1)

    await index.recordVersionUsage(ds.manager, {
      lessonVersionId: versionId,
      schoolId,
      mediaIds: [file, file],
    })

    expect(await rowsFor(versionId)).toHaveLength(1)
  })

  it('refuses a file another school holds, naming it unknown here', async () => {
    const theirs = await storedFile(otherSchoolId)
    const versionId = await versionOf(lessonId, 1)

    await expect(
      index.recordVersionUsage(ds.manager, {
        lessonVersionId: versionId,
        schoolId,
        mediaIds: [theirs],
      }),
    ).rejects.toMatchObject({ refusal: 'media-unknown' })

    expect(await rowsFor(versionId)).toEqual([])
  })

  it('names a lesson once however many of its versions hold the file', async () => {
    const file = await storedFile()

    for (const version of [1, 2]) {
      await index.recordVersionUsage(ds.manager, {
        lessonVersionId: await versionOf(lessonId, version),
        schoolId,
        mediaIds: [file],
      })
    }

    expect(await index.lessonsUsing(file)).toEqual([
      { lessonId, title: 'Lesson 1. The illustrated one' },
    ])
  })

  it('answers with nothing for a file no version points at', async () => {
    expect(await index.lessonsUsing(await storedFile())).toEqual([])
  })
})
