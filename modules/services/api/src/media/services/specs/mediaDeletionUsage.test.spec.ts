import { testingDataSource } from '@vidya/api/shared/datasources'
import { AuditLogService } from '@vidya/api/shared/services'
import { MediaId, SchoolId, StorageProfileId, UserId } from '@vidya/domain'
import { AuditLog, Media, School, StorageProfile, User } from '@vidya/entities'
import { randomUUID } from 'crypto'
import { DataSource } from 'typeorm'

import { MediaDeletionService } from '../mediaDeletion.service'
import { MediaRowsService } from '../mediaRows.service'
import { MediaUsageService } from '../mediaUsage.service'
import { MediaUsageIndexService } from '../mediaUsageIndex.service'
import { SchoolStorageService } from '../schoolStorage.service'

describe('what deleting a file does to the bytes a school is charged for', () => {
  let ds: DataSource
  let rows: MediaRowsService
  let usage: MediaUsageService
  let deletion: MediaDeletionService
  let schoolId: SchoolId
  let otherSchoolId: SchoolId
  let profileId: StorageProfileId
  let actorId: UserId
  const removed: string[] = []

  const profileFor = async (school: SchoolId): Promise<StorageProfileId> => {
    const profile = await ds.getRepository(StorageProfile).save({
      schoolId: school,
      provider: 's3-compatible',
      endpoint: 'https://de-s3.storage.bunnycdn.com',
      r2AccountId: null,
      region: 'de',
      bucket: 'vidya-demo',
      prefix: `school/${school}`,
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

    return profile.id
  }

  const schoolNamed = async (name: string): Promise<SchoolId> => {
    const school = await ds.getRepository(School).save({ name, config: {} } as School)

    return school.id
  }

  const pendingFile = async (
    sizeBytes: number,
    school: SchoolId = schoolId,
    profile: StorageProfileId = profileId,
  ): Promise<Media> =>
    rows.createPending({
      id: randomUUID() as MediaId,
      schoolId: school,
      profileId: profile,
      kind: 'image',
      storageKey: `school/${school}/image/${randomUUID()}/original.png`,
      name: 'lesson-cover.png',
      mimeType: 'image/png',
      sizeBytes,
      createdBy: actorId,
    })

  const readyFile = async (
    sizeBytes: number,
    school: SchoolId = schoolId,
    profile: StorageProfileId = profileId,
  ): Promise<Media> => {
    const created = await pendingFile(sizeBytes, school, profile)

    return rows.markReady(created, { sizeBytes, mimeType: 'image/png', sha256: null })
  }

  beforeEach(async () => {
    ds = await testingDataSource()
    rows = new MediaRowsService(ds)
    usage = new MediaUsageService(ds)
    removed.length = 0

    const user = await ds.getRepository(User).save({ email: 'owner@example.com' } as User)
    actorId = user.id as UserId

    schoolId = await schoolNamed('One')
    otherSchoolId = await schoolNamed('Two')
    profileId = await profileFor(schoolId)

    deletion = new MediaDeletionService(
      ds,
      rows,
      new MediaUsageIndexService(ds),
      {
        openProfileById: async () => ({
          storage: { remove: async (key: string) => void removed.push(key) },
        }),
      } as unknown as SchoolStorageService,
      new AuditLogService(ds.getRepository(AuditLog)),
    )
  })

  afterEach(async () => {
    await ds.destroy()
  })

  it('takes the size of the deleted file off what the school occupies', async () => {
    const dropped = await readyFile(2048)
    await readyFile(3072)
    expect(await usage.usedBytesOf(schoolId)).toBe(5120)

    await deletion.deleteMedia(dropped, actorId)

    expect(await usage.usedBytesOf(schoolId)).toBe(3072)
    expect(removed).toEqual([dropped.storageKey])
  })

  it('leaves what one school occupies alone when another school deletes a file', async () => {
    await readyFile(2048)
    const otherProfileId = await profileFor(otherSchoolId)
    const foreign = await readyFile(4096, otherSchoolId, otherProfileId)

    await deletion.deleteMedia(foreign, actorId)

    expect(await usage.usedBytesOf(schoolId)).toBe(2048)
    expect(await usage.usedBytesOf(otherSchoolId)).toBe(0)
  })

  it('moves nothing off the school when the deleted row was never charged', async () => {
    await readyFile(2048)
    const waiting = await pendingFile(4096)
    expect(await usage.usedBytesOf(schoolId)).toBe(2048)

    await deletion.deleteMedia(waiting, actorId)

    expect(await usage.usedBytesOf(schoolId)).toBe(2048)
    expect(await usage.reservedBytesOf(schoolId)).toBe(0)
  })

  it('charges nothing at all once the last file of a pending upload is gone', async () => {
    const waiting = await pendingFile(4096)

    await deletion.deleteMedia(waiting, actorId)

    expect(await usage.usedBytesOf(schoolId)).toBe(0)
    expect(await rows.findById(waiting.id)).toBeNull()
  })
})
