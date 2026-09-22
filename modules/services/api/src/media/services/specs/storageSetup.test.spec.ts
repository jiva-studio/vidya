import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { testingDataSource } from '@vidya/api/shared/datasources'
import { SchoolId } from '@vidya/domain'
import { School } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { DataSource } from 'typeorm'

import { StorageFailedError } from '../../storageFailure'
import { EndpointGuardService } from '../endpointGuard.service'
import { SecretSealingService } from '../secretSealing.service'
import { StorageProbeService } from '../storageProbe.service'
import { StorageProfilesService } from '../storageProfiles.service'
import { StorageQuotasService } from '../storageQuotas.service'
import { StorageSetupService } from '../storageSetup.service'

type Config = ConfigType<typeof MediaConfig>

const DEFAULT_QUOTA = 5_368_709_120
const SCHOOL_QUOTA = 53_687_091_200

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

describe('a school storage profile as it is configured', () => {
  let ds: DataSource
  let setup: StorageSetupService
  let profiles: StorageProfilesService
  let sealing: SecretSealingService
  let schoolId: SchoolId
  let policed: string[]
  let dialled: string[]

  beforeEach(async () => {
    ds = await testingDataSource()
    profiles = new StorageProfilesService(ds)
    sealing = new SecretSealingService(config)
    policed = []
    dialled = []

    setup = new StorageSetupService(
      config,
      {
        assertEndpointAllowed: async (endpoint: string) => {
          policed.push(endpoint)
          return { endpoint, addresses: ['203.0.113.10'] }
        },
      } as unknown as EndpointGuardService,
      {
        probeCredentials: async (credentials: { endpoint: string }) =>
          void dialled.push(credentials.endpoint),
      } as unknown as StorageProbeService,
      profiles,
      new StorageQuotasService(ds),
      sealing,
    )

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    schoolId = school.id
  })

  afterEach(async () => {
    await ds.destroy()
  })

  it('answers the ceiling the school asked for, and the installation default before that', async () => {
    await expect(setup.readUsage(schoolId)).resolves.toMatchObject({
      quotaBytes: DEFAULT_QUOTA,
      usedBytes: 0,
    })

    await setup.configureProfile(schoolId, { ...credentials('first'), quotaBytes: SCHOOL_QUOTA })

    await expect(setup.readUsage(schoolId)).resolves.toMatchObject({ quotaBytes: SCHOOL_QUOTA })
  })

  // The ceiling and the bytes already stored belong to the school; the row
  // that holds its keys is replaced on every rotation and carries neither.
  it('keeps the ceiling and the occupied bytes when a key is rotated', async () => {
    await setup.configureProfile(schoolId, { ...credentials('first'), quotaBytes: SCHOOL_QUOTA })
    const before = await setup.readUsage(schoolId)

    const rotated = await setup.configureProfile(schoolId, credentials('second'))

    expect(rotated.secretTail).toBe('cond')
    await expect(setup.readUsage(schoolId)).resolves.toMatchObject({
      quotaBytes: before.quotaBytes,
      usedBytes: before.usedBytes,
    })
    expect(rotated.quotaBytes).toBe(SCHOOL_QUOTA)
  })

  it('writes a new row for rotated keys rather than editing the one in place', async () => {
    const first = await setup.configureProfile(schoolId, credentials('first'))
    const second = await setup.configureProfile(schoolId, credentials('second'))

    const rows = await ds.query('SELECT "id", "retiredAt" FROM "storage_profiles"')

    expect(second.id).not.toBe(first.id)
    expect(rows).toHaveLength(2)
    expect(rows.filter((row: { retiredAt: Date | null }) => row.retiredAt === null)).toHaveLength(1)
  })

  // The sealed document goes through a json column, where a raw buffer would
  // come back as mangled text; nothing says so until the secret will not open.
  it('seals credentials that still open after a round trip through the row', async () => {
    const view = await setup.configureProfile(schoolId, credentials('the-zone-password'))
    const stored = await profiles.findCurrentFor(schoolId)

    expect(stored?.secrets.secret.ciphertext).toEqual(expect.any(String))
    expect(sealing.openSecret(stored!.secrets, { schoolId, profileId: stored!.id })).toBe(
      'the-zone-password',
    )
    expect(view.secretTail).toBe('word')
  })

  it('does not open a document carried into another school row', async () => {
    await setup.configureProfile(schoolId, credentials('the-zone-password'))
    const stored = await profiles.findCurrentFor(schoolId)

    expect(() =>
      sealing.openSecret(stored!.secrets, {
        schoolId: '11111111-2222-3333-4444-555555555555' as SchoolId,
        profileId: stored!.id,
      }),
    ).toThrow()
  })

  it('stores the address a school typed, and polices it before dialling it', async () => {
    const view = await setup.configureProfile(schoolId, credentials('first'))
    const stored = await profiles.findCurrentFor(schoolId)

    expect(stored?.provider).toBe('s3-compatible')
    expect(stored?.endpoint).toBe('https://de-s3.storage.bunnycdn.com')
    expect(view.endpoint).toBe('https://de-s3.storage.bunnycdn.com')
    expect(policed).toEqual(['https://de-s3.storage.bunnycdn.com'])
    expect(dialled).toEqual(['https://de-s3.storage.bunnycdn.com'])
  })

  it('composes the address of a named provider, storing none and answering it', async () => {
    const view = await setup.configureProfile(schoolId, {
      ...credentials('first'),
      provider: 'aws',
      region: 'eu-central-1',
      endpoint: undefined,
    })
    const stored = await profiles.findCurrentFor(schoolId)

    expect(dialled).toEqual(['https://s3.eu-central-1.amazonaws.com'])
    expect(stored?.endpoint).toBeNull()
    expect(view.provider).toBe('aws')
    expect(view.endpoint).toBe('https://s3.eu-central-1.amazonaws.com')
  })

  // The host is ours for a named provider, so there is nothing for the
  // allowlist to decide about.
  it('does not ask the allowlist about an address it composed itself', async () => {
    await setup.configureProfile(schoolId, {
      ...credentials('first'),
      provider: 'bunny',
      region: 'de',
      endpoint: undefined,
    })

    expect(policed).toEqual([])
    expect(dialled).toEqual(['https://de-s3.storage.bunnycdn.com'])
  })

  it('addresses R2 by the account, and keeps it apart from the region', async () => {
    await setup.configureProfile(schoolId, {
      ...credentials('first'),
      provider: 'r2',
      region: 'auto',
      r2AccountId: 'a1b2c3d4e5',
      endpoint: undefined,
    })
    const stored = await profiles.findCurrentFor(schoolId)

    expect(dialled).toEqual(['https://a1b2c3d4e5.r2.cloudflarestorage.com'])
    expect(stored?.r2AccountId).toBe('a1b2c3d4e5')
    expect(stored?.region).toBe('auto')
  })

  it('refuses an address beside a named provider, and writes nothing', async () => {
    await expect(
      setup.configureProfile(schoolId, {
        ...credentials('first'),
        provider: 'aws',
        region: 'eu-central-1',
        endpoint: 'https://attacker.example',
      }),
    ).rejects.toThrow(StorageFailedError)

    expect(dialled).toEqual([])
    await expect(profiles.findCurrentFor(schoolId)).resolves.toBeNull()
  })

  it('refuses a provider that was given nothing to compose its address from', async () => {
    await expect(
      setup.configureProfile(schoolId, {
        ...credentials('first'),
        provider: 'r2',
        region: 'auto',
        endpoint: undefined,
      }),
    ).rejects.toThrow(StorageFailedError)

    expect(dialled).toEqual([])
    await expect(profiles.findCurrentFor(schoolId)).resolves.toBeNull()
  })
})
