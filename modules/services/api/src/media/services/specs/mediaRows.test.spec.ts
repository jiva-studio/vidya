import { testingDataSource } from '@vidya/api/shared/datasources'
import { MediaId, SchoolId, StorageProfileId } from '@vidya/domain'
import { Media, School, StorageProfile, User } from '@vidya/entities'
import { randomUUID } from 'crypto'
import { DataSource } from 'typeorm'

import { MediaRowsService, PendingMediaDraft } from '../mediaRows.service'
import { MediaUsageService } from '../mediaUsage.service'

const HOUR = 60 * 60 * 1000

describe('the rows behind an upload', () => {
  let ds: DataSource
  let rows: MediaRowsService
  let usage: MediaUsageService
  let schoolId: SchoolId
  let profileId: StorageProfileId
  let userId: string

  const draft = (overrides: Partial<PendingMediaDraft> = {}): PendingMediaDraft => ({
    id: randomUUID() as MediaId,
    schoolId,
    profileId,
    kind: 'image',
    storageKey: `school/${schoolId}/image/${randomUUID()}/original.png`,
    name: 'lesson-cover.png',
    mimeType: 'image/png',
    sizeBytes: 2048,
    createdBy: userId as never,
    ...overrides,
  })

  const usedBytesOf = async (): Promise<number> =>
    Number((await ds.getRepository(StorageProfile).findOneByOrFail({ id: profileId })).usedBytes)

  beforeEach(async () => {
    ds = await testingDataSource()
    rows = new MediaRowsService(ds)
    usage = new MediaUsageService(ds)

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    schoolId = school.id

    const user = await ds.getRepository(User).save({ email: 'one@example.com' } as User)
    userId = user.id

    const profile = await ds.getRepository(StorageProfile).save({
      schoolId,
      kind: 's3',
      endpoint: 'https://de-s3.storage.bunnycdn.com',
      region: 'de',
      bucket: 'vidya-demo',
      prefix: `school/${schoolId}`,
      accessKeyId: 'vidya-demo',
      delivery: 'presigned',
      video: { kind: 'none' },
      quotaBytes: null,
      usedBytes: '0',
    } as StorageProfile)
    profileId = profile.id
  })

  afterEach(async () => {
    await ds.destroy()
  })

  it('writes a row that is waiting for its bytes', async () => {
    const created = await rows.createPending(draft())

    expect(created.status).toBe('pending')
    expect(await rows.findById(created.id)).toMatchObject({ status: 'pending' })
  })

  it('holds the declared size until storage says otherwise', async () => {
    const created = await rows.createPending(draft({ sizeBytes: 4096 }))

    expect(await usage.reservedBytesOf(schoolId)).toBe(4096)
    expect(Number((await rows.findById(created.id))?.sizeBytes)).toBe(4096)
  })

  it('charges the profile the bytes storage reported, not the declared ones', async () => {
    const created = await rows.createPending(draft({ sizeBytes: 4096 }))

    await rows.markReady(created, { sizeBytes: 2048, mimeType: 'image/png', sha256: null })

    expect(await usedBytesOf()).toBe(2048)
    expect(Number((await rows.findById(created.id))?.sizeBytes)).toBe(2048)
    expect(await usage.reservedBytesOf(schoolId)).toBe(0)
  })

  it('takes the type from what was confirmed', async () => {
    const created = await rows.createPending(draft({ mimeType: 'image/png' }))

    const ready = await rows.markReady(created, {
      sizeBytes: 2048,
      mimeType: 'image/jpeg',
      sha256: 'digest',
    })

    expect(ready).toMatchObject({ status: 'ready', mimeType: 'image/jpeg', sha256: 'digest' })
  })

  it('finds the stored file a digest already belongs to', async () => {
    const stored = await rows.createPending(draft())
    await rows.markReady(stored, { sizeBytes: 2048, mimeType: 'image/png', sha256: 'digest' })

    const second = await rows.createPending(draft())

    expect(await rows.findReadyByDigest(schoolId, 'digest')).toMatchObject({ id: stored.id })
    expect(await rows.findReadyByDigest(schoolId, 'other')).toBeNull()
    expect(second.status).toBe('pending')
  })

  it('counts a refused upload as neither charged nor reserved', async () => {
    const created = await rows.createPending(draft({ sizeBytes: 4096 }))

    await rows.markFailed(created.id)

    expect(await usage.reservedBytesOf(schoolId)).toBe(0)
    expect(await usedBytesOf()).toBe(0)
  })

  it('answers with the pending rows old enough to give up on', async () => {
    const abandoned = await rows.createPending(draft())
    const running = await rows.createPending(draft())
    const stored = await rows.createPending(draft())

    await ds
      .getRepository(Media)
      .update({ id: abandoned.id }, { createdAt: new Date(Date.now() - 48 * HOUR) })
    await rows.markReady(stored, { sizeBytes: 2048, mimeType: 'image/png', sha256: null })
    await ds
      .getRepository(Media)
      .update({ id: stored.id }, { createdAt: new Date(Date.now() - 48 * HOUR) })

    const found = await rows.findAbandoned(new Date(Date.now() - 24 * HOUR))

    expect(found.map((media) => media.id)).toEqual([abandoned.id])
    expect(running.status).toBe('pending')
  })

  it('counts the stored files of a school by kind', async () => {
    const image = await rows.createPending(draft())
    const audio = await rows.createPending(draft({ kind: 'audio', mimeType: 'audio/mpeg' }))

    await rows.markReady(image, { sizeBytes: 2048, mimeType: 'image/png', sha256: null })
    await rows.markReady(audio, { sizeBytes: 4096, mimeType: 'audio/mpeg', sha256: null })

    await expect(usage.readUsage(schoolId)).resolves.toEqual({
      reservedBytes: 0,
      countsByKind: { image: 1, audio: 1, video: 0 },
    })
  })

  it('lists every bucket still in use', async () => {
    await ds.getRepository(StorageProfile).update({ id: profileId }, { retiredAt: null })

    expect((await rows.findLiveProfiles()).map((profile) => profile.id)).toEqual([profileId])
  })

  it('leaves nothing behind when a row is dropped', async () => {
    const created = await rows.createPending(draft())

    await rows.deleteRow(created.id)

    expect(await rows.findById(created.id)).toBeNull()
  })
})
