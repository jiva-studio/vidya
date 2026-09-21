import { MediaStoragePort, StoredObject, toIsoDateTime, UploadGrant } from '@vidya/domain'

import { createMediaServices, MediaServices } from './mediaContext'

type Session = { key: string; uploadId: string; startedAt: Date }

/** Storage that remembers which prefix each caller asked it about. */
class ListeningStorage implements MediaStoragePort {
  readonly listed: string[] = []

  async signUpload(key: string): Promise<UploadGrant> {
    return {
      method: 'put',
      url: `memory://bucket/${key}`,
      headers: {},
      fields: {},
      expiresAt: toIsoDateTime(new Date(Date.now() + 900_000)),
    }
  }

  async signRead(): Promise<never> {
    throw new Error('this suite never reads')
  }

  async signStream(): Promise<never> {
    throw new Error('this suite never streams')
  }

  async head(): Promise<StoredObject | undefined> {
    return undefined
  }

  async remove(): Promise<void> {
    // Nothing is stored, so nothing is deleted.
  }

  async *listPrefix(prefix: string): AsyncIterable<StoredObject> {
    this.listed.push(prefix)
    yield* []
  }

  async *listUnfinished(prefix: string): AsyncIterable<Session> {
    this.listed.push(prefix)
    yield* []
  }

  async abortUnfinished(): Promise<void> {
    // No session is ever listed, so none is ended.
  }
}

describe('the prefix a school writes and is swept under', () => {
  let services: MediaServices
  let storage: ListeningStorage

  beforeEach(async () => {
    storage = new ListeningStorage()

    // A profile saved with no prefix at all, which is the shape that made the
    // two paths disagree: one read it as "the whole bucket", the other as "use
    // the default".
    services = await createMediaServices({ storage, prefix: '' })
  })

  afterEach(async () => {
    await services.close()
  })

  const keyOfNewUpload = async (): Promise<string> => {
    const granted = await services.uploads.signUpload(
      {
        schoolId: services.schoolId,
        kind: 'image',
        name: 'lesson-cover.png',
        mimeType: 'image/png',
        sizeBytes: 2048,
      },
      services.userId,
    )

    return (await services.rows.findById(granted.mediaId))?.storageKey ?? ''
  }

  it('sweeps the very prefix an upload was written under', async () => {
    const key = await keyOfNewUpload()

    await services.sweep.sweepAbandonedUploads()

    const written = key.slice(0, key.indexOf('/image/'))
    expect(storage.listed).toEqual([written])
  })

  it('never reads a stored prefix as the whole bucket', async () => {
    await keyOfNewUpload()

    await services.sweep.sweepAbandonedUploads()

    expect(storage.listed).not.toContain('')
  })
})
