import { randomUUID } from 'node:crypto'

import { MediaId, MediaStoragePort, StoredObject } from '@vidya/domain'
import { Media } from '@vidya/entities'

import { createMediaServices, MediaServices } from './mediaContext'

const HOUR = 60 * 60 * 1000

/** Storage that only remembers which objects the sweep asked it to delete. */
class CountingStorage implements MediaStoragePort {
  readonly removed: string[] = []

  async signUpload(): Promise<never> {
    throw new Error('the sweep never signs an upload')
  }

  async signRead(): Promise<never> {
    throw new Error('the sweep never signs a read')
  }

  async signStream(): Promise<never> {
    throw new Error('the sweep never signs a stream')
  }

  async head(): Promise<StoredObject | undefined> {
    return undefined
  }

  async remove(key: string): Promise<void> {
    this.removed.push(key)
  }

  async *listPrefix(): AsyncIterable<StoredObject> {
    // The sweep works from the rows, never from a listing.
  }

  async *listUnfinished(): AsyncIterable<never> {
    // This suite is about the age a row is collected at, not about sessions.
  }

  async abortUnfinished(): Promise<void> {
    // See `listUnfinished`: there is no session for this to end.
  }
}

describe('how long an upload is given before the sweep presumes it abandoned', () => {
  const env = process.env

  let services: MediaServices
  let storage: CountingStorage

  const abandonedRow = async (ageHours: number): Promise<Media> => {
    const created = await services.rows.createPending({
      id: randomUUID() as MediaId,
      schoolId: services.schoolId,
      profileId: services.profile.id,
      kind: 'image',
      storageKey: `school/${services.schoolId}/image/${randomUUID()}/original.png`,
      name: 'lesson-cover.png',
      mimeType: 'image/png',
      sizeBytes: 2048,
      createdBy: services.userId,
    })

    await services.ds
      .getRepository(Media)
      .update({ id: created.id }, { createdAt: new Date(Date.now() - ageHours * HOUR) })

    return created
  }

  const sweepWithWindow = async (windowMs: number): Promise<void> => {
    process.env.VIDYA_MEDIA_ABANDONED_AFTER_MS = String(windowMs)
    storage = new CountingStorage()
    services = await createMediaServices({ storage })
  }

  beforeEach(() => {
    process.env = { ...env }
  })

  afterEach(async () => {
    await services.close()
    process.env = env
  })

  it('collects a row that outlived the window the installation set', async () => {
    await sweepWithWindow(HOUR)
    const abandoned = await abandonedRow(2)

    await services.sweep.sweepAbandonedUploads()

    expect(storage.removed).toEqual([abandoned.storageKey])
    expect(await services.rows.findById(abandoned.id)).toBeNull()
  })

  it('leaves a row alone until the window the installation set has passed', async () => {
    await sweepWithWindow(48 * HOUR)
    const waiting = await abandonedRow(30)

    await services.sweep.sweepAbandonedUploads()

    expect(storage.removed).toEqual([])
    expect(await services.rows.findById(waiting.id)).not.toBeNull()
  })
})
