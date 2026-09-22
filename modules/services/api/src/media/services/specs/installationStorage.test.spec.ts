import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { testingDataSource } from '@vidya/api/shared/datasources'
import { SchoolId, StorageProfileId } from '@vidya/domain'
import { School, StorageProfile } from '@vidya/entities'
import { randomUUID } from 'crypto'
import { DataSource } from 'typeorm'

import { StorageFailedError } from '../../storageFailure'
import { InstallationStorageService } from '../installationStorage.service'
import { MediaUsageService } from '../mediaUsage.service'
import { SecretSealingService } from '../secretSealing.service'
import { StorageProfileDraft, StorageProfilesService } from '../storageProfiles.service'
import { quotaBytesFor, StorageQuotasService } from '../storageQuotas.service'

type Config = ConfigType<typeof MediaConfig>

const MASTER_KEY = Buffer.alloc(32, 9)
const SECRET = 'd41d8cd9-8f00-b204-e980-0998ecf8427e'
const QUOTA = 5_368_709_120

const DEFAULT_STORAGE = {
  endpoint: 'https://de-s3.storage.bunnycdn.com',
  region: 'de',
  bucket: 'vidya-installation',
  accessKeyId: 'installation-key',
  secret: SECRET,
  publicBaseUrl: null,
}

const configWith = (overrides: Partial<Config> = {}): Config =>
  ({
    masterKey: MASTER_KEY,
    keyVersion: 1,
    defaultStorage: DEFAULT_STORAGE,
    defaultQuotaBytes: QUOTA,
    ...overrides,
  }) as Config

const ownDraftFor = (schoolId: SchoolId, sealing: SecretSealingService): StorageProfileDraft => {
  const id = randomUUID() as StorageProfileId

  return {
    id,
    schoolId,
    provider: 's3-compatible',
    endpoint: 'https://de-s3.storage.bunnycdn.com',
    region: 'de',
    r2AccountId: null,
    bucket: 'school-own-bucket',
    prefix: `school/${schoolId}`,
    accessKeyId: 'school-key',
    delivery: 'presigned',
    publicBaseUrl: null,
    secrets: sealing.sealProfile({ secret: 'school-secret' }, { schoolId, profileId: id }),
    verifiedAt: new Date('2026-09-21T12:00:00.000Z'),
  }
}

describe('a school that handed over no storage credentials', () => {
  let ds: DataSource
  let profiles: StorageProfilesService
  let sealing: SecretSealingService
  let installation: InstallationStorageService
  let schoolId: SchoolId

  const buildWith = (config: Config): InstallationStorageService => {
    sealing = new SecretSealingService(config)
    return new InstallationStorageService(config, profiles, sealing)
  }

  beforeEach(async () => {
    ds = await testingDataSource()
    profiles = new StorageProfilesService(ds)
    installation = buildWith(configWith())

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    schoolId = school.id
  })

  afterEach(async () => {
    await ds.destroy()
  })

  const rowsOf = async (): Promise<StorageProfile[]> =>
    ds.getRepository(StorageProfile).find({ order: { createdAt: 'ASC' } })

  it('writes it a row on the storage of the installation, under a prefix of its own', async () => {
    const profile = await installation.provisionProfileFor(schoolId)

    expect(profile.bucket).toBe('vidya-installation')
    expect(profile.endpoint).toBe(DEFAULT_STORAGE.endpoint)
    expect(profile.region).toBe('de')
    expect(profile.accessKeyId).toBe('installation-key')
    expect(profile.prefix).toBe(`school/${schoolId}`)
    expect(profile.delivery).toBe('presigned')
    await expect(profiles.findCurrentFor(schoolId)).resolves.toMatchObject({ id: profile.id })
  })

  // Neither number is on the row any more: the ceiling is the installation's
  // default until someone decides otherwise, and the occupied bytes are summed
  // from the school's files.
  it('limits it to the quota the installation set, with nothing occupied yet', async () => {
    const profile = await installation.provisionProfileFor(schoolId)

    const decided = await new StorageQuotasService(ds).findQuotaBytes(schoolId)

    expect(quotaBytesFor(decided, profile.schoolId !== null, QUOTA)).toBe(QUOTA)
    expect(await new MediaUsageService(ds).usedBytesOf(schoolId)).toBe(0)
  })

  it('serves the bytes through the CDN the installation named, when it named one', async () => {
    const cdn = 'https://cdn.installation.example'
    const withCdn = buildWith(
      configWith({ defaultStorage: { ...DEFAULT_STORAGE, publicBaseUrl: cdn } }),
    )

    const profile = await withCdn.provisionProfileFor(schoolId)

    expect(profile.delivery).toBe('public')
    expect(profile.publicBaseUrl).toBe(cdn)
  })

  it('keeps the secret of the installation sealed, and opens it for that row alone', async () => {
    const profile = await installation.provisionProfileFor(schoolId)

    expect(JSON.stringify(profile.secrets)).not.toContain(SECRET)
    expect(sealing.openSecret(profile.secrets, { schoolId, profileId: profile.id })).toBe(SECRET)
    expect(() =>
      sealing.openSecret(profile.secrets, {
        schoolId,
        profileId: randomUUID() as StorageProfileId,
      }),
    ).toThrow(StorageFailedError)
  })

  it('hands the same row back on the next upload rather than a second bucket', async () => {
    const first = await installation.provisionProfileFor(schoolId)
    const second = await installation.provisionProfileFor(schoolId)

    expect(second.id).toBe(first.id)
    expect(await rowsOf()).toHaveLength(1)
  })

  // Two uploads starting together both insert, so what stops the second row is
  // the unique index on the live profile and not a read taken before it.
  it('loses the insert rather than writing a second live profile', async () => {
    const written = await profiles.insertIfAbsent(ownDraftFor(schoolId, sealing))
    const lost = await profiles.insertIfAbsent(ownDraftFor(schoolId, sealing))

    expect(written).not.toBeNull()
    expect(lost).toBeNull()
    expect(await rowsOf()).toHaveLength(1)
    await expect(profiles.findCurrentFor(schoolId)).resolves.toMatchObject({ id: written?.id })
  })

  it('is refused when the installation has no storage of its own', async () => {
    const noEndpoint = buildWith(
      configWith({ defaultStorage: { ...DEFAULT_STORAGE, endpoint: '' } }),
    )
    const noBucket = buildWith(configWith({ defaultStorage: { ...DEFAULT_STORAGE, bucket: '' } }))

    await expect(noEndpoint.provisionProfileFor(schoolId)).rejects.toThrow(
      new StorageFailedError('not-configured'),
    )
    await expect(noBucket.provisionProfileFor(schoolId)).rejects.toThrow(
      new StorageFailedError('not-configured'),
    )
    expect(await rowsOf()).toHaveLength(0)
  })

  it('leaves its files readable once it brings credentials of its own', async () => {
    const lent = await installation.provisionProfileFor(schoolId)

    const own = await profiles.replaceProfile(ownDraftFor(schoolId, sealing))

    await expect(profiles.findCurrentFor(schoolId)).resolves.toMatchObject({ id: own.id })
    const retired = await profiles.findById(lent.id)

    expect(retired?.retiredAt).not.toBeNull()
    expect(retired?.bucket).toBe('vidya-installation')
    expect(sealing.openSecret(retired!.secrets, { schoolId, profileId: lent.id })).toBe(SECRET)
  })
})
