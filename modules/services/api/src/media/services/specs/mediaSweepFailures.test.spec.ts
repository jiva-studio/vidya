import { randomUUID } from 'node:crypto'

import { Logger } from '@nestjs/common'
import { MediaId, MediaStoragePort, StoredObject } from '@vidya/domain'
import { Media } from '@vidya/entities'

import { createMediaServices, MediaServices } from './mediaContext'

const HOUR = 60 * 60 * 1000

type Session = { key: string; uploadId: string; startedAt: Date }

/** Storage that refuses to delete one key and answers everything else. */
class RefusingStorage implements MediaStoragePort {
  readonly removed: string[] = []
  readonly aborted: Session[] = []

  refuses = ''

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

  async head(): Promise<StoredObject | undefined> {
    return undefined
  }

  async remove(key: string): Promise<void> {
    if (key === this.refuses) throw new Error('storage refused to delete the object')

    this.removed.push(key)
  }

  async *listPrefix(): AsyncIterable<StoredObject> {
    // The sweep works from the rows and the sessions, never from a listing.
  }

  async *listUnfinished(): AsyncIterable<Session> {
    for (const session of this.sessions) yield session
  }

  async abortUnfinished(key: string, uploadId: string): Promise<void> {
    const found = this.sessions.find(
      (session) => session.key === key && session.uploadId === uploadId,
    )
    if (found) this.aborted.push(found)
  }
}

describe('sweeping when storage will not delete one of the objects', () => {
  let services: MediaServices
  let storage: RefusingStorage
  let logged: string[]
  let stuck: Media
  let clearable: Media

  const stale: Session = {
    key: 'school/one/video/stale/original.mp4',
    uploadId: 'stale-session',
    startedAt: new Date(Date.now() - 48 * HOUR),
  }

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

  beforeEach(async () => {
    storage = new RefusingStorage([stale])
    services = await createMediaServices({ storage })

    // The oldest row is the poisoned one, because the sweep takes the oldest
    // first and a tick that stops there never reaches anything else.
    stuck = await abandonedRow(72)
    clearable = await abandonedRow(48)
    storage.refuses = stuck.storageKey

    logged = []
    jest.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args.map((arg) => String(arg)).join(' '))
    })
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await services.close()
  })

  it('finishes the tick instead of throwing, so the hour after is not lost', async () => {
    await expect(services.sweep.sweepAbandonedUploads()).resolves.toBeUndefined()
  })

  it('clears the rows it can when the oldest one will not go', async () => {
    await services.sweep.sweepAbandonedUploads().catch(() => undefined)

    expect(storage.removed).toEqual([clearable.storageKey])
    expect(await services.rows.findById(clearable.id)).toBeNull()
  })

  it('ends the sessions nobody finished even though a row would not go', async () => {
    await services.sweep.sweepAbandonedUploads().catch(() => undefined)

    expect(storage.aborted).toEqual([stale])
  })

  it('names the row it could not clear, so an operator can go and look', async () => {
    await services.sweep.sweepAbandonedUploads().catch(() => undefined)

    expect(logged.join('\n')).toContain(stuck.id)
  })

  it('keeps the row it could not clear, rather than forgetting the object exists', async () => {
    await services.sweep.sweepAbandonedUploads().catch(() => undefined)

    expect(await services.rows.findById(stuck.id)).not.toBeNull()
  })

  it('reaches the later rows again on the next tick, not only the poisoned one', async () => {
    await services.sweep.sweepAbandonedUploads().catch(() => undefined)
    const later = await abandonedRow(36)

    await services.sweep.sweepAbandonedUploads().catch(() => undefined)

    expect(storage.removed).toEqual([clearable.storageKey, later.storageKey])
  })
})
