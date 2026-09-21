import { Logger } from '@nestjs/common'
import { testingDataSource } from '@vidya/api/shared/datasources'
import {
  emptyLessonContent,
  MediaId,
  MediaStoragePort,
  SchoolId,
  StorageProfileId,
} from '@vidya/domain'
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
import { DataSource, QueryRunner } from 'typeorm'

import { MediaRowsService } from '../mediaRows.service'
import { MediaSweepService } from '../mediaSweep.service'
import { SchoolStorage, SchoolStorageService } from '../schoolStorage.service'

const HOUR = 60 * 60 * 1000

type Session = { key: string; uploadId: string; startedAt: Date }

/** A port that records what the sweep asked of it and nothing else. */
class RecordingStorage implements MediaStoragePort {
  readonly removed: string[] = []
  readonly aborted: Session[] = []
  readonly listed: string[] = []

  constructor(private readonly sessions: Session[] = []) {}

  async signUpload(): Promise<never> {
    throw new Error('the sweep never signs an upload')
  }

  async signRead(): Promise<never> {
    throw new Error('the sweep never signs a read')
  }

  async signStream(): Promise<never> {
    throw new Error('the sweep never signs a stream')
  }

  async head(): Promise<undefined> {
    return undefined
  }

  async remove(key: string): Promise<void> {
    this.removed.push(key)
  }

  async *listPrefix(): AsyncIterable<never> {
    // The sweep never lists objects: it works from the rows and the sessions.
  }

  async *listUnfinished(prefix: string): AsyncIterable<Session> {
    this.listed.push(prefix)
    for (const session of this.sessions) yield session
  }

  async abortUnfinished(key: string, uploadId: string): Promise<void> {
    const found = this.sessions.find(
      (session) => session.key === key && session.uploadId === uploadId,
    )
    if (found) this.aborted.push(found)
  }
}

describe('sweeping what an abandoned upload left behind', () => {
  let ds: DataSource
  let rows: MediaRowsService
  let sweep: MediaSweepService
  let storage: RecordingStorage
  let storages: SchoolStorageService
  let schoolId: SchoolId
  let profileId: StorageProfileId
  let userId: string

  const stale: Session = {
    key: 'school/one/video/stale/original.mp4',
    uploadId: 'stale-session',
    startedAt: new Date(Date.now() - 48 * HOUR),
  }

  const running: Session = {
    key: 'school/one/video/running/original.mp4',
    uploadId: 'running-session',
    startedAt: new Date(Date.now() - HOUR),
  }

  const pendingRow = async (ageHours: number): Promise<Media> => {
    const created = await rows.createPending({
      id: randomUUID() as MediaId,
      schoolId,
      profileId,
      kind: 'image',
      storageKey: `school/${schoolId}/image/${randomUUID()}/original.png`,
      name: 'lesson-cover.png',
      mimeType: 'image/png',
      sizeBytes: 2048,
      createdBy: userId as never,
    })

    await ds
      .getRepository(Media)
      .update({ id: created.id }, { createdAt: new Date(Date.now() - ageHours * HOUR) })

    return created
  }

  /**
   * A deletion that archived its row and then never finished: the bytes are no
   * longer charged, the object may or may not still be there, and only the sweep
   * can tell which.
   */
  const archivedRow = async (ageHours: number): Promise<Media> => {
    const created = await rows.createPending({
      id: randomUUID() as MediaId,
      schoolId,
      profileId,
      kind: 'image',
      storageKey: `school/${schoolId}/image/${randomUUID()}/original.png`,
      name: 'lesson-cover.png',
      mimeType: 'image/png',
      sizeBytes: 2048,
      createdBy: userId as never,
    })

    const archivedAt = new Date(Date.now() - ageHours * HOUR)
    await ds
      .getRepository(Media)
      .update({ id: created.id }, { status: 'archived', archivedAt, createdAt: archivedAt })

    return created
  }

  /** A file nobody asked to delete, which the sweep must never touch. */
  const readyRow = async (ageHours: number): Promise<Media> => {
    const created = await pendingRow(ageHours)
    await ds.getRepository(Media).update({ id: created.id }, { status: 'ready' })

    return created
  }

  /**
   * A row the database will not let go of, because a lesson version names it.
   * Content should never name a row that is not ready, and while it can the
   * sweep meets a row it cannot drop.
   */
  const claimedByALesson = async (media: Media): Promise<void> => {
    const course = await ds.getRepository(Course).save({
      name: 'Bhakti-shastri',
      learningType: 'group',
      status: 'draft',
      schoolId,
    } as Course)

    const lesson = await ds.getRepository(Lesson).save({
      courseId: course.id,
      schoolId,
      lessonNumber: 1,
      title: 'Lesson 1. The illustrated one',
    } as Lesson)

    const version = await ds.getRepository(LessonVersion).save({
      lessonId: lesson.id,
      version: 1,
      status: 'draft',
      content: emptyLessonContent(),
      createdAt: new Date(),
    } as LessonVersion)

    await ds.getRepository(MediaUsage).insert({
      mediaId: media.id,
      lessonVersionId: version.id,
      schoolId,
      createdAt: new Date(),
    })
  }

  beforeEach(async () => {
    ds = await testingDataSource()
    rows = new MediaRowsService(ds)
    storage = new RecordingStorage([stale, running])

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    schoolId = school.id

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
    } as StorageProfile)
    profileId = profile.id

    const opened = (): SchoolStorage => ({ profile, storage })
    storages = {
      openCurrent: async () => opened(),
      openProfileById: async () => opened(),
      openProfile: () => opened(),
    } as unknown as SchoolStorageService

    sweep = new MediaSweepService(ds, rows, storages)
  })

  /**
   * A sweep whose lock lives on a connection of its own, which is the only
   * thing it takes from the datasource; the rows still go through the real one.
   */
  const sweepLockedBy = (taken: boolean, statements: string[]): MediaSweepService =>
    new MediaSweepService(
      { createQueryRunner: () => lockedRunner(taken, statements) } as unknown as DataSource,
      rows,
      storages,
    )

  afterEach(async () => {
    await ds.destroy()
  })

  it('deletes a row that waited a day for its bytes, and the object with it', async () => {
    const abandoned = await pendingRow(48)

    await sweep.sweepAbandonedUploads()

    expect(storage.removed).toEqual([abandoned.storageKey])
    expect(await rows.findById(abandoned.id)).toBeNull()
  })

  it('leaves an upload that may still be running alone', async () => {
    const recent = await pendingRow(1)

    await sweep.sweepAbandonedUploads()

    expect(storage.removed).toEqual([])
    expect(await rows.findById(recent.id)).not.toBeNull()
  })

  it('ends a session that has been open for more than a day', async () => {
    await sweep.sweepAbandonedUploads()

    expect(storage.aborted).toEqual([stale])
    expect(storage.listed).toEqual([`school/${schoolId}`])
  })

  it('takes the lock for the work and gives it back afterwards', async () => {
    const statements: string[] = []
    await pendingRow(48)

    await sweepLockedBy(true, statements).sweepAbandonedUploads()

    expect(statements.filter((sql) => /pg_try_advisory_lock/.test(sql))).toHaveLength(1)
    expect(statements.filter((sql) => /pg_advisory_unlock/.test(sql))).toHaveLength(1)
    expect(storage.removed).toHaveLength(1)
  })

  it('does nothing at all while another instance holds the lock', async () => {
    const abandoned = await pendingRow(48)

    await sweepLockedBy(false, []).sweepAbandonedUploads()

    expect(storage.removed).toEqual([])
    expect(storage.aborted).toEqual([])
    expect(await rows.findById(abandoned.id)).not.toBeNull()
  })

  it('drops the other abandoned rows when one of them cannot be dropped', async () => {
    const stuck = await pendingRow(72)
    await claimedByALesson(stuck)
    const droppable = await pendingRow(48)

    await sweep.sweepAbandonedUploads()

    expect(await rows.findById(droppable.id)).toBeNull()
  })

  it('ends the stale sessions when a row could not be dropped', async () => {
    const stuck = await pendingRow(72)
    await claimedByALesson(stuck)

    await sweep.sweepAbandonedUploads()

    expect(storage.aborted).toEqual([stale])
  })

  it('finishes a deletion that archived its row and never took the object out', async () => {
    const archived = await archivedRow(48)

    await sweep.sweepAbandonedUploads()

    expect(storage.removed).toEqual([archived.storageKey])
    expect(await rows.findById(archived.id)).toBeNull()
  })

  it('leaves a stored file nobody asked to delete alone', async () => {
    const kept = await readyRow(48)

    await sweep.sweepAbandonedUploads()

    expect(storage.removed).toEqual([])
    expect(await rows.findById(kept.id)).not.toBeNull()
  })

  it('names the row it could not drop where an operator will read it', async () => {
    const complaints: string[] = []
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message) => {
      complaints.push(String(message))
    })

    const stuck = await pendingRow(72)
    await claimedByALesson(stuck)

    await sweep.sweepAbandonedUploads()
    jest.restoreAllMocks()

    expect(complaints.join('\n')).toContain(stuck.id)
  })
})

/** A connection that answers the lock attempt as asked and remembers the rest. */
const lockedRunner = (taken: boolean, statements: string[]) =>
  ({
    isReleased: false,
    connect: async () => undefined,
    query: async (sql: string) => {
      statements.push(sql)
      return [{ taken }]
    },
    release: async () => undefined,
  }) as unknown as QueryRunner
