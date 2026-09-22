import { testingDataSource } from '@vidya/api/shared/datasources'
import { MediaId, MediaStoragePort, SchoolId, StorageProfileId } from '@vidya/domain'
import { Media, School, StorageProfile, User } from '@vidya/entities'
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
