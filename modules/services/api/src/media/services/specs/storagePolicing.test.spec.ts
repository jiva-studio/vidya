import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { testingDataSource } from '@vidya/api/shared/datasources'
import { SchoolId } from '@vidya/domain'
import { School } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { DataSource } from 'typeorm'

import { StorageCredentials } from '../../infra/ports'
import { EndpointGuardService } from '../endpointGuard.service'
import { SecretSealingService } from '../secretSealing.service'
import { StorageProbeService } from '../storageProbe.service'
import { StorageProfilesService } from '../storageProfiles.service'
import { StorageQuotasService } from '../storageQuotas.service'
import { StorageSetupService } from '../storageSetup.service'

type Config = ConfigType<typeof MediaConfig>

const ENDPOINT = 'https://de-s3.storage.bunnycdn.com'
const APPROVED_ADDRESS = '52.219.44.10'

const config = {
  masterKey: Buffer.alloc(32, 7),
  keyVersion: 1,
  defaultQuotaBytes: 5_368_709_120,
} as Config

const credentials = (secret: string): protocol.UpsertStorageProfileRequest => ({
  provider: 's3-compatible',
  endpoint: ENDPOINT,
  region: 'de',
  bucket: 'vidya-demo',
  accessKeyId: 'vidya-demo',
  secret,
})

/** What an approval carries once it is a value rather than an absence of a throw. */
const approvalOf = (endpoint: string) => ({ endpoint, addresses: [APPROVED_ADDRESS] })

/** The addresses a dial was told to use, whether or not the type names them yet. */
const addressesGivenTo = (dialled: StorageCredentials): unknown =>
  (dialled as { addresses?: unknown }).addresses

describe('every address the API dials', () => {
  let ds: DataSource
  let setup: StorageSetupService
  let schoolId: SchoolId
  let policed: string[]
  let dialled: StorageCredentials[]

  beforeEach(async () => {
    ds = await testingDataSource()
    policed = []
    dialled = []

    setup = new StorageSetupService(
      config,
      {
        assertEndpointAllowed: async (endpoint: string) => {
          policed.push(endpoint)
          return approvalOf(endpoint)
        },
      } as unknown as EndpointGuardService,
      {
        probeCredentials: async (given: StorageCredentials) => void dialled.push(given),
      } as unknown as StorageProbeService,
      new StorageProfilesService(ds),
      new StorageQuotasService(ds),
      new SecretSealingService(config),
    )

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    schoolId = school.id
  })

  afterEach(async () => {
    await ds.destroy()
  })

  it('is checked before it is dialled, when the profile is first configured', async () => {
    await setup.configureProfile(schoolId, credentials('the-zone-password'))

    expect(policed).toEqual([ENDPOINT])
    expect(dialled).toHaveLength(1)
  })

  it('is checked again before a verify dials the stored profile', async () => {
    await setup.configureProfile(schoolId, credentials('the-zone-password'))
    await setup.verifyProfile(schoolId)

    expect(policed).toEqual([ENDPOINT, ENDPOINT])
  })

  it('is checked once for every dial, so no path reaches storage unpoliced', async () => {
    await setup.configureProfile(schoolId, credentials('the-zone-password'))
    await setup.verifyProfile(schoolId)
    await setup.verifyProfile(schoolId)

    expect(policed).toHaveLength(dialled.length)
  })

  // The name is the school's to re-point at any moment, so an approval that
  // hands on only permission and not the address it approved has proved
  // nothing about what the request will reach.
  it('is the address the check approved, not the name it was typed as', async () => {
    await setup.configureProfile(schoolId, credentials('the-zone-password'))

    expect(addressesGivenTo(dialled[0])).toEqual([APPROVED_ADDRESS])
  })

  it('is the approved address on a verify as well as on the first configure', async () => {
    await setup.configureProfile(schoolId, credentials('the-zone-password'))
    await setup.verifyProfile(schoolId)

    expect(addressesGivenTo(dialled[1])).toEqual([APPROVED_ADDRESS])
  })
})
