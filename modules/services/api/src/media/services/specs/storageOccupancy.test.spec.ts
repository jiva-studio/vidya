import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { testingDataSource } from '@vidya/api/shared/datasources'
import { MediaId, SchoolId, StorageProfileId, UserId } from '@vidya/domain'
import { School, User } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { randomUUID } from 'crypto'
import { DataSource } from 'typeorm'

import { EndpointGuardService } from '../endpointGuard.service'
import { MediaRowsService } from '../mediaRows.service'
import { MediaUsageService } from '../mediaUsage.service'
import { SecretSealingService } from '../secretSealing.service'
import { StorageProbeService } from '../storageProbe.service'
import { StorageProfilesService } from '../storageProfiles.service'
import { StorageQuotasService } from '../storageQuotas.service'
import { StorageSetupService } from '../storageSetup.service'

type Config = ConfigType<typeof MediaConfig>

const DEFAULT_QUOTA = 5_368_709_120
const SCHOOL_QUOTA = 40_000

const config = {
  masterKey: Buffer.alloc(32, 7),
  keyVersion: 1,
  defaultQuotaBytes: DEFAULT_QUOTA,
} as Config

const credentials = (secret: string): protocol.UpsertStorageProfileRequest => ({
  provider: 's3-compatible',
  endpoint: 'https://de-s3.storage.bunnycdn.com',
  region: 'de',
  bucket: 'vidya-demo',
  accessKeyId: 'vidya-demo',
  secret,
})

const nothingPoliced = {
  assertEndpointAllowed: async () => undefined,
} as unknown as EndpointGuardService
const nothingDialled = { probeCredentials: async () => undefined } as unknown as StorageProbeService

describe('the bytes a school occupies', () => {
  let ds: DataSource
  let setup: StorageSetupService
  let profiles: StorageProfilesService
  let rows: MediaRowsService
  let usage: MediaUsageService
  let schoolId: SchoolId
  let otherSchoolId: SchoolId
  let createdBy: UserId

  const schoolNamed = async (name: string): Promise<SchoolId> =>
    (await ds.getRepository(School).save({ name, config: {} } as School)).id

  const storeFile = async (
    sizeBytes: number,
    school: SchoolId = schoolId,
  ): Promise<{ id: MediaId; profileId: StorageProfileId }> => {
    const profile = await profiles.findCurrentFor(school)
    const pending = await rows.createPending({
      id: randomUUID() as MediaId,
      schoolId: school,
      profileId: profile!.id,
      kind: 'image',
      storageKey: `school/${school}/image/${randomUUID()}/original.png`,
      name: 'lesson-cover.png',
      mimeType: 'image/png',
      sizeBytes,
      createdBy,
    })

    await rows.markReady(pending, { sizeBytes, mimeType: 'image/png', sha256: null })

    return { id: pending.id, profileId: profile!.id }
  }

  beforeEach(async () => {
    ds = await testingDataSource()
    profiles = new StorageProfilesService(ds)
    rows = new MediaRowsService(ds)
    usage = new MediaUsageService(ds)

    setup = new StorageSetupService(
      config,
      nothingPoliced,
      nothingDialled,
      profiles,
      new StorageQuotasService(ds),
      new SecretSealingService(config),
      usage,
    )

    schoolId = await schoolNamed('One')
    otherSchoolId = await schoolNamed('Two')
    createdBy = (await ds.getRepository(User).save({ email: 'one@example.com' } as User))
      .id as UserId

    await setup.configureProfile(schoolId, { ...credentials('first'), quotaBytes: SCHOOL_QUOTA })
    await setup.configureProfile(otherSchoolId, credentials('theirs'))
  })

  afterEach(async () => {
    await ds.destroy()
  })

  it('is the sum of the files it has stored', async () => {
    await storeFile(2048)
    await storeFile(4096)

    expect(await usage.usedBytesOf(schoolId)).toBe(6144)
    await expect(setup.readUsage(schoolId)).resolves.toMatchObject({ usedBytes: 6144 })
  })

  it('leaves out a file that is still waiting for its bytes, and one that never landed', async () => {
    const waiting = await rows.createPending({
      id: randomUUID() as MediaId,
      schoolId,
      profileId: (await profiles.findCurrentFor(schoolId))!.id,
      kind: 'image',
      storageKey: `school/${schoolId}/image/${randomUUID()}/original.png`,
      name: 'waiting.png',
      mimeType: 'image/png',
      sizeBytes: 4096,
      createdBy,
    })
    const refused = await storeFile(1024)
    await rows.markFailed(refused.id)

    expect(await usage.usedBytesOf(schoolId)).toBe(0)
    await expect(setup.readUsage(schoolId)).resolves.toMatchObject({
      usedBytes: 0,
      reservedBytes: 4096,
    })
    expect(waiting.status).toBe('pending')
  })

  it('leaves out what another school stored', async () => {
    await storeFile(2048)
    await storeFile(8192, otherSchoolId)

    expect(await usage.usedBytesOf(schoolId)).toBe(2048)
    expect(await usage.usedBytesOf(otherSchoolId)).toBe(8192)
  })

  // Rotating a credential writes a new profile row and retires the old one, so
  // anything counted on that row would start again from zero here.
  it('survives a key rotation, ceiling and files alike', async () => {
    await storeFile(2048)
    const before = await setup.readUsage(schoolId)

    const rotated = await setup.configureProfile(schoolId, credentials('second'))

    expect(before.usedBytes).toBe(2048)
    expect(rotated.usedBytes).toBe(2048)
    expect(rotated.quotaBytes).toBe(SCHOOL_QUOTA)
    await expect(setup.readUsage(schoolId)).resolves.toMatchObject({
      usedBytes: 2048,
      quotaBytes: SCHOOL_QUOTA,
    })
  })

  // The files were written through the retired row, and are still charged to
  // the school that uploaded them.
  it('keeps counting files uploaded through a profile that has been retired', async () => {
    const stored = await storeFile(2048)
    await setup.configureProfile(schoolId, credentials('second'))

    const live = await profiles.findCurrentFor(schoolId)

    expect(live?.id).not.toBe(stored.profileId)
    expect(await usage.usedBytesOf(schoolId)).toBe(2048)
  })

  it('answers what a school reads back on its profile, not a number from the row', async () => {
    await storeFile(2048)

    const view = await setup.findProfileView(schoolId)

    expect(view).toMatchObject({ usedBytes: 2048, quotaBytes: SCHOOL_QUOTA, lent: false })
  })
})
