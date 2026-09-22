import { testDatabase, testingDataSource } from '@vidya/api/shared/datasources'
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

/**
 * What only a real Postgres can prove about a refused deletion.
 *
 * pg-mem does not undo the statements a failed one was preceded by, so under it
 * a row dropped outside the deletion's transaction reads exactly the same as
 * one dropped inside it.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

describeOnPostgres('a deletion whose audit entry cannot be written', () => {
  let ds: DataSource
  let rows: MediaRowsService
  let usage: MediaUsageService
  let schoolId: SchoolId
  let profileId: StorageProfileId
  let actorId: UserId

  beforeEach(async () => {
    ds = await testingDataSource()
    rows = new MediaRowsService(ds)
    usage = new MediaUsageService(ds)

    const user = await ds.getRepository(User).save({ email: 'owner@example.com' } as User)
    actorId = user.id as UserId

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    schoolId = school.id

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
  })

  afterEach(async () => {
    await ds.destroy()
  })

  const storedFile = async (sizeBytes: number): Promise<Media> => {
    const created = await rows.createPending({
      id: randomUUID() as MediaId,
      schoolId,
      profileId,
      kind: 'image',
      storageKey: `school/${schoolId}/image/${randomUUID()}/original.png`,
      name: 'lesson-cover.png',
      mimeType: 'image/png',
      sizeBytes,
      createdBy: actorId,
    })

    return rows.markReady(created, { sizeBytes, mimeType: 'image/png', sha256: null })
  }

  const deletionWith = (auditLog: AuditLogService): MediaDeletionService =>
    new MediaDeletionService(
      ds,
      rows,
      new MediaUsageIndexService(ds),
      {
        openProfileById: async () => ({ storage: { remove: async () => undefined } }),
      } as unknown as SchoolStorageService,
      auditLog,
    )

  it('leaves the row where it was, and the bytes charged to the school', async () => {
    const stored = await storedFile(2048)
    const auditLog = new AuditLogService(ds.getRepository(AuditLog))
    jest.spyOn(auditLog, 'record').mockRejectedValue(new Error('trail unavailable'))

    await expect(deletionWith(auditLog).deleteMedia(stored, actorId)).rejects.toThrow(
      'trail unavailable',
    )

    expect(await rows.findById(stored.id)).not.toBeNull()
    expect(await usage.usedBytesOf(schoolId)).toBe(2048)
  })
})
