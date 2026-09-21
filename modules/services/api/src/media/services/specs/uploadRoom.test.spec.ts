import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { testingDataSource } from '@vidya/api/shared/datasources'
import { MediaId, SchoolId, UploadGrant, UserId } from '@vidya/domain'
import { School, StorageProfile, User } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { randomUUID } from 'crypto'
import { DataSource } from 'typeorm'

import { MediaRefusedError } from '../../mediaRefusal'
import { MediaRowsService } from '../mediaRows.service'
import { MediaUploadsService } from '../mediaUploads.service'
import { MediaUsageService } from '../mediaUsage.service'
import { SchoolStorageService } from '../schoolStorage.service'
import { StorageQuotasService } from '../storageQuotas.service'

type Config = ConfigType<typeof MediaConfig>

const QUOTA = 4096

const config = {
  maxImageBytes: 10_485_760,
  maxAudioBytes: 209_715_200,
  maxVideoBytes: 2_147_483_648,
  hashLimitBytes: 268_435_456,
  defaultQuotaBytes: 1_000_000,
} as Config

const grant: UploadGrant = {
  method: 'put',
  url: 'https://vidya-demo/signed',
  headers: {},
  fields: {},
  expiresAt: '2026-09-21T12:10:00.000Z' as UploadGrant['expiresAt'],
}

/**
 * Room at the signature, with the bytes already stored and the ones promised to
 * grants in flight both standing in the way.
 *
 * Driven below the controller because what is under test is the arithmetic of
 * the refusal: storage itself only has to answer with a signature, so the fake
 * does that and nothing else.
 */
describe('asking for room to upload', () => {
  let ds: DataSource
  let uploads: MediaUploadsService
  let rows: MediaRowsService
  let schoolId: SchoolId
  let profile: StorageProfile
  let createdBy: UserId

  const ask = async (sizeBytes: number): Promise<protocol.CreateUploadResponse> =>
    uploads.signUpload(
      { schoolId, kind: 'image', name: 'cover.png', mimeType: 'image/png', sizeBytes },
      createdBy,
    )

  const storeFile = async (sizeBytes: number): Promise<void> => {
    const pending = await rows.createPending({
      id: randomUUID() as MediaId,
      schoolId,
      profileId: profile.id,
      kind: 'image',
      storageKey: `school/${schoolId}/image/${randomUUID()}/original.png`,
      name: 'stored.png',
      mimeType: 'image/png',
      sizeBytes,
      createdBy,
    })

    await rows.markReady(pending, { sizeBytes, mimeType: 'image/png', sha256: null })
  }

  beforeEach(async () => {
    ds = await testingDataSource()
    rows = new MediaRowsService(ds)

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    schoolId = school.id
    createdBy = (await ds.getRepository(User).save({ email: 'one@example.com' } as User))
      .id as UserId

    profile = await ds.getRepository(StorageProfile).save({
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

    const quotas = new StorageQuotasService(ds)
    await quotas.setQuotaBytes(schoolId, QUOTA)

    uploads = new MediaUploadsService(
      config,
      quotas,
      rows,
      {
        openCurrent: async () => ({
          profile,
          storage: { signUpload: async () => grant },
        }),
      } as unknown as SchoolStorageService,
      new MediaUsageService(ds),
    )
  })

  afterEach(async () => {
    await ds.destroy()
  })

  it('signs an upload that fits beside what is already stored', async () => {
    await storeFile(2048)

    await expect(ask(2048)).resolves.toMatchObject({ grant })
  })

  // The bytes of a stored file are not on the profile any more, so a grant that
  // ignored the sum would hand out room the bucket does not have.
  it('refuses one that does not fit beside what is already stored', async () => {
    await storeFile(3000)

    await expect(ask(2000)).rejects.toThrow(new MediaRefusedError('quota-exceeded'))
    expect(await rows.findReadyByDigest(schoolId, 'none')).toBeNull()
  })

  it('counts a grant that has not completed against the next one', async () => {
    await ask(3000)

    await expect(ask(2000)).rejects.toThrow(new MediaRefusedError('quota-exceeded'))
  })

  it('counts what is stored and what is promised together, not one or the other', async () => {
    await storeFile(2048)
    await ask(1024)

    await expect(ask(1024)).resolves.toMatchObject({ grant })
    await expect(ask(1)).rejects.toThrow(new MediaRefusedError('quota-exceeded'))
  })

  it('leaves a school nobody capped to store beyond the installation default', async () => {
    await new StorageQuotasService(ds).setQuotaBytes(schoolId, null)
    await storeFile(3000)

    await expect(ask(1_000_000)).resolves.toMatchObject({ grant })
  })
})
