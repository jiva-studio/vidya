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

import { addressedMediaIdsIn } from './contentAddresses'

type VersionRow = { id: string; content: LessonContent }

const blockId = () => domain.asId<domain.BlockId>(faker.string.uuid())
const sectionId = () => domain.asId<domain.SectionId>(faker.string.uuid())

/**
 * Two sections rather than one, and a text block between the media ones: a scan
 * that only reads the first section or assumes every block carries a url would
 * otherwise agree with a table that is wrong.
 */
const contentWith = (urls: string[]): LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [
    {
      id: sectionId(),
      title: 'Reading',
      assessment: 'none',
      blocks: [{ id: blockId(), type: 'text' as const, content: 'Read this' }],
    },
    {
      id: sectionId(),
      title: 'Illustrations',
      assessment: 'teacher',
      blocks: urls.map((url) => ({
        id: blockId(),
        type: 'audio' as const,
        source: 'upload' as const,
        url,
      })),
    },
  ],
})

/**
 * Every `(version, media)` pair the stored documents actually name, read off the
 * address tables rather than off the extractor the save uses: a scan that copies
 * the extractor agrees with it about the fields it forgot.
 */
const scanVersions = async (dataSource: DataSource): Promise<string[]> => {
  const rows: VersionRow[] = await dataSource.query('SELECT "id", "content" FROM "lesson_versions"')
  const pairs = new Set<string>()

  for (const row of rows) {
    for (const mediaId of addressedMediaIdsIn(row.content)) pairs.add(`${row.id}:${mediaId}`)
  }

  return [...pairs].sort()
}

/** A video hosted elsewhere, with a poster out of this school's own library. */
const contentWithPoster = (posterUrl: string): LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [
    {
      id: sectionId(),
      title: 'Watch',
      assessment: 'none',
      blocks: [
        {
          id: blockId(),
          type: 'video' as const,
          source: 'youtube' as const,
          url: 'https://www.youtube.com/watch?v=Bhakti',
          posterUrl,
        },
      ],
    },
  ],
})

const recordedUsages = async (dataSource: DataSource): Promise<string[]> => {
  const rows: { mediaId: string; lessonVersionId: string }[] = await dataSource.query(
    'SELECT "mediaId", "lessonVersionId" FROM "media_usages"',
  )

  return rows.map((row) => `${row.lessonVersionId}:${row.mediaId}`).sort()
}

describe('agreement between the usage table and the lesson documents', () => {
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

  const storeAudio = async (): Promise<domain.MediaId> => {
    const asked = await flow.askUpload(
      flow.imageUpload(schoolId, {
        kind: 'audio',
        mimeType: 'audio/mpeg',
        name: 'lecture.mp3',
        sizeBytes: 4096,
        sha256: undefined,
      }),
      flow.ctx.one.users.owner,
    )

    expect(asked.status).toBe(201)
    await flow.putBytes(asked.body.grant, Buffer.alloc(4096, 4))

    const completed = await flow.completeUpload(asked.body.mediaId, {}, flow.ctx.one.users.owner)
    expect(completed.status).toBe(200)

    return asked.body.mediaId as domain.MediaId
  }

  const addLesson = async (lessonNumber: number): Promise<domain.LessonId> =>
    (
      await app.get(LessonsService).create({
        courseId,
        schoolId,
        lessonNumber,
        title: `Lesson ${lessonNumber}`,
      })
    ).id

  it('holds exactly the pairs a scan of the stored content finds, after edits and revisions', async () => {
    const first = await storeAudio()
    const second = await storeAudio()
    const third = await storeAudio()

    const one = await addLesson(1)
    const oneDraft = await versions.createInitialDraft(one)
    await versions.saveDraft(one, oneDraft.id, contentWith([mediaPath(first), mediaPath(second)]))
    await versions.saveDraft(one, oneDraft.id, contentWith([mediaPath(second)]))
    await versions.publish(one, oneDraft.id)

    const revision = await versions.openDraft(one)
    await versions.saveDraft(one, revision.id, contentWith([mediaPath(second), mediaPath(third)]))

    const two = await addLesson(2)
    const twoDraft = await versions.createInitialDraft(two)
    await versions.saveDraft(two, twoDraft.id, contentWith([mediaPath(third)]))

    const three = await addLesson(3)
    await versions.createInitialDraft(three)

    expect(await recordedUsages(dataSource)).toEqual(await scanVersions(dataSource))
  })

  it('holds the poster a video block shows as well as the files beside it', async () => {
    const poster = await storeAudio()
    const lesson = await addLesson(1)
    const draft = await versions.createInitialDraft(lesson)

    await versions.saveDraft(lesson, draft.id, contentWithPoster(mediaPath(poster)))

    expect(await recordedUsages(dataSource)).toEqual(await scanVersions(dataSource))
  })

  it('holds nothing once every block naming a file is gone from the content', async () => {
    const stored = await storeAudio()
    const lesson = await addLesson(1)
    const draft = await versions.createInitialDraft(lesson)

    await versions.saveDraft(lesson, draft.id, contentWith([mediaPath(stored)]))
    await versions.saveDraft(lesson, draft.id, contentWith([]))

    expect(await scanVersions(dataSource)).toEqual([])
    expect(await recordedUsages(dataSource)).toEqual([])
  })
})
