import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { TEST_MASTER_KEY } from '@vidya/api/media/controllers/specs/context'
import {
  createMediaFlow,
  MediaFlow,
  runDueJobs,
} from '@vidya/api/media/controllers/specs/uploadFlow'
import {
  InMemoryStorage,
  MEDIA_SIGNED_HTTP,
  MEDIA_STORAGE,
  MediaStorageFactory,
  StorageCredentials,
} from '@vidya/api/media/infra'
import { MediaStoragePort, UploadGrant } from '@vidya/domain'

const HOUR = 60 * 60 * 1000

type Granted = { mediaId: string; grant: UploadGrant }
type UnfinishedSession = { key: string; uploadId: string; startedAt: Date }

describe('clearing up after uploads that were abandoned', () => {
  let app: INestApplication
  let flow: MediaFlow

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
    await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner)
  })

  afterEach(async () => {
    await app.close()
  })

  const ask = async (sizeBytes: number): Promise<Granted> => {
    const response = await flow.askUpload(
      flow.imageUpload(flow.ctx.one.school.id, { sizeBytes, sha256: undefined }),
      flow.ctx.one.users.owner,
    )

    expect(response.status).toBe(201)
    return { mediaId: response.body.mediaId, grant: response.body.grant as UploadGrant }
  }

  const abandon = async (sizeBytes: number, ageHours: number): Promise<Granted> => {
    const granted = await ask(sizeBytes)
    await flow.putBytes(granted.grant, Buffer.alloc(sizeBytes, 4))
    await flow.ageRow(granted.mediaId, new Date(Date.now() - ageHours * HOUR))
    return granted
  }

  const finish = async (sizeBytes: number, storedBytes = sizeBytes): Promise<Granted> => {
    const granted = await ask(sizeBytes)
    await flow.putBytes(granted.grant, Buffer.alloc(storedBytes, 4))
    await flow.completeUpload(granted.mediaId, {}, flow.ctx.one.users.owner)
    return granted
  }

  const usage = async () =>
    (await flow.usageOf(flow.ctx.one.school.id, flow.ctx.one.users.owner)).body

  it('deletes a row that waited a day for bytes, and the bytes with it', async () => {
    const abandoned = await abandon(4096, 48)

    await runDueJobs(app)

    expect(await flow.mediaRow(abandoned.mediaId)).toBeUndefined()
    expect(flow.objectBehind(abandoned.grant)).toBeUndefined()
    expect(flow.removalsOf(flow.keyBehind(abandoned.grant))).toBe(1)
  })

  it('leaves a recent pending row alone, because its upload may still be running', async () => {
    const running = await abandon(4096, 1)

    await runDueJobs(app)

    expect((await flow.mediaRow(running.mediaId))?.status).toBe('pending')
    expect(flow.objectBehind(running.grant)).toBeDefined()
  })

  it('leaves a stored file and a refused one exactly as they were', async () => {
    const ready = await finish(2048)
    const failed = await finish(2048, 4096)
    await flow.ageRow(ready.mediaId, new Date(Date.now() - 48 * HOUR))
    await flow.ageRow(failed.mediaId, new Date(Date.now() - 48 * HOUR))

    await runDueJobs(app)

    expect((await flow.mediaRow(ready.mediaId))?.status).toBe('ready')
    expect(flow.objectBehind(ready.grant)).toBeDefined()
    expect((await flow.mediaRow(failed.mediaId))?.status).toBe('failed')
  })

  it('gives back the quota the abandoned grant had reserved', async () => {
    await abandon(4096, 48)
    expect(await usage()).toMatchObject({ reservedBytes: 4096 })

    await runDueJobs(app)

    expect(await usage()).toMatchObject({ usedBytes: 0, reservedBytes: 0 })
  })
})

/**
 * Unfinished multipart sessions are invisible to a listing and still paid for,
 * and nothing in memory is ever half-written — so the sessions are handed to
 * the port here rather than produced by an upload.
 */
class StorageWithSessions implements MediaStorageFactory {
  readonly aborted: UnfinishedSession[] = []

  constructor(
    private readonly base: InMemoryStorage,
    private readonly sessions: UnfinishedSession[],
  ) {}

  openStorage(credentials: StorageCredentials): MediaStoragePort {
    const port = this.base.openStorage(credentials)
    const { sessions, aborted } = this

    return {
      signUpload: (key, limits) => port.signUpload(key, limits),
      signRead: (key, kind) => port.signRead(key, kind),
      signStream: (prefix, kind) => port.signStream(prefix, kind),
      head: (key) => port.head(key),
      remove: (key) => port.remove(key),
      listPrefix: (prefix) => port.listPrefix(prefix),
      listUnfinished: async function* () {
        for (const session of sessions) yield session
      },
      abortUnfinished: async (key, uploadId) => {
        const found = sessions.find(
          (session) => session.key === key && session.uploadId === uploadId,
        )
        if (found) aborted.push(found)
      },
    }
  }
}

describe('clearing up upload sessions that were never finished', () => {
  let app: INestApplication
  let storage: StorageWithSessions

  const stale: UnfinishedSession = {
    key: 'school/one/video/stale/original.mp4',
    uploadId: 'stale-session',
    startedAt: new Date(Date.now() - 48 * HOUR),
  }

  const running: UnfinishedSession = {
    key: 'school/one/video/running/original.mp4',
    uploadId: 'running-session',
    startedAt: new Date(Date.now() - HOUR),
  }

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY

    const base = new InMemoryStorage()
    storage = new StorageWithSessions(base, [stale, running])

    app = await createTestingApp([
      { provide: MEDIA_STORAGE, useValue: storage },
      { provide: MEDIA_SIGNED_HTTP, useValue: base },
    ])

    const flow = await createMediaFlow(app)
    await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner)
  })

  afterEach(async () => {
    await app.close()
  })

  it('aborts a session that has been open for more than a day', async () => {
    await runDueJobs(app)

    expect(storage.aborted).toEqual([stale])
  })

  it('leaves a session that started an hour ago to finish', async () => {
    await runDueJobs(app)

    expect(storage.aborted).not.toContain(running)
  })
})
