import { testingDataSource } from '@vidya/api/shared/datasources'
import { SchoolId, StorageProfileId } from '@vidya/domain'
import { School, StorageProfile } from '@vidya/entities'
import { randomUUID } from 'crypto'
import { DataSource } from 'typeorm'

import { StorageProfileDraft, StorageProfilesService } from '../storageProfiles.service'

const sealedValue = (fill: number) => ({
  ciphertext: Buffer.alloc(24, fill).toString('base64'),
  nonce: Buffer.alloc(12, fill).toString('base64'),
})

const draftFor = (schoolId: SchoolId, bucket: string): StorageProfileDraft => ({
  id: randomUUID() as StorageProfileId,
  schoolId,
  provider: 's3-compatible',
  endpoint: 'https://de-s3.storage.bunnycdn.com',
  r2AccountId: null,
  region: 'de',
  bucket,
  prefix: `school/${schoolId}`,
  accessKeyId: 'vidya-demo',
  delivery: 'presigned',
  publicBaseUrl: null,
  secrets: {
    keyVersion: 1,
    dek: sealedValue(1),
    secret: sealedValue(2),
    tokenSecret: null,
  },
  verifiedAt: new Date('2026-09-21T12:00:00.000Z'),
})

describe('the rows behind a school storage profile', () => {
  let ds: DataSource
  let profiles: StorageProfilesService
  let schoolId: SchoolId

  beforeEach(async () => {
    ds = await testingDataSource()
    profiles = new StorageProfilesService(ds)

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    schoolId = school.id
  })

  afterEach(async () => {
    await ds.destroy()
  })

  const rowsOf = async (): Promise<StorageProfile[]> =>
    ds.getRepository(StorageProfile).find({ order: { bucket: 'ASC' } })

  const currentProfileIdOf = async (): Promise<string | null> =>
    (await ds.getRepository(School).findOneByOrFail({ id: schoolId })).currentStorageProfileId

  it('has none until a school hands over credentials', async () => {
    await expect(profiles.findCurrentFor(schoolId)).resolves.toBeNull()
    await expect(currentProfileIdOf()).resolves.toBeNull()
  })

  it('points the school at the profile it just wrote', async () => {
    const saved = await profiles.replaceProfile(draftFor(schoolId, 'first'))

    await expect(currentProfileIdOf()).resolves.toBe(saved.id)
    await expect(profiles.findCurrentFor(schoolId)).resolves.toMatchObject({ bucket: 'first' })
  })

  it('keeps the sealed document exactly as it was handed over, so it still opens', async () => {
    const draft = draftFor(schoolId, 'first')

    await profiles.replaceProfile(draft)
    const found = await profiles.findCurrentFor(schoolId)

    expect(found?.secrets).toEqual(draft.secrets)
    expect(found?.secrets.secret.ciphertext).toBe(draft.secrets.secret.ciphertext)
    expect(found?.secrets.keyVersion).toBe(1)
  })

  it('retires the previous row rather than editing it', async () => {
    const first = await profiles.replaceProfile(draftFor(schoolId, 'first'))
    const second = await profiles.replaceProfile(draftFor(schoolId, 'second'))

    const rows = await rowsOf()

    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.id === first.id)?.retiredAt).not.toBeNull()
    expect(rows.find((row) => row.id === second.id)?.retiredAt).toBeNull()
    await expect(currentProfileIdOf()).resolves.toBe(second.id)
  })

  // A file is read through the profile that wrote it, so a retired row has to
  // keep the credentials it was given.
  it('leaves a retired row otherwise untouched', async () => {
    const draft = draftFor(schoolId, 'first')
    await profiles.replaceProfile(draft)
    await profiles.replaceProfile(draftFor(schoolId, 'second'))

    const retired = (await rowsOf()).find((row) => row.id === draft.id)

    expect(retired?.accessKeyId).toBe(draft.accessKeyId)
    expect(retired?.secrets.secret.ciphertext).toBe(draft.secrets.secret.ciphertext)
    expect(retired?.bucket).toBe('first')
  })

  it('returns a school to the storage of the installation without deleting its rows', async () => {
    const saved = await profiles.replaceProfile(draftFor(schoolId, 'first'))

    await profiles.retireProfile(schoolId)

    await expect(profiles.findCurrentFor(schoolId)).resolves.toBeNull()
    await expect(currentProfileIdOf()).resolves.toBeNull()
    expect((await rowsOf()).find((row) => row.id === saved.id)?.retiredAt).not.toBeNull()
  })

  it('records what the last probe said, and clears it when the next one succeeds', async () => {
    const saved = await profiles.replaceProfile(draftFor(schoolId, 'first'))

    await profiles.recordVerification(saved.id, null, 'storage-secret-unreadable')
    const failed = await profiles.findCurrentFor(schoolId)

    expect(failed?.verifyError).toBe('storage-secret-unreadable')
    expect(failed?.verifiedAt).toBeNull()

    const provedAt = new Date('2026-09-22T09:00:00.000Z')
    await profiles.recordVerification(saved.id, provedAt, null)
    const proved = await profiles.findCurrentFor(schoolId)

    expect(proved?.verifyError).toBeNull()
    expect(proved?.verifiedAt).toEqual(provedAt)
  })

  // Neither the ceiling nor the bytes already stored may sit on a row that is
  // replaced whenever a key is rotated: the counter that used to live here was
  // read from the live profile and written to the one that stored the file.
  it('carries neither a quota nor a counter of occupied bytes', async () => {
    const saved = await profiles.replaceProfile(draftFor(schoolId, 'first'))

    expect(saved).not.toHaveProperty('quotaBytes')
    expect(saved).not.toHaveProperty('usedBytes')

    const columns = (
      await ds.query('SELECT * FROM "storage_profiles" WHERE "id" = $1', [saved.id])
    )[0]

    expect(Object.keys(columns).sort()).toEqual([
      'accessKeyId',
      'bucket',
      'createdAt',
      'delivery',
      'endpoint',
      'id',
      'prefix',
      'provider',
      'publicBaseUrl',
      'r2AccountId',
      'region',
      'retiredAt',
      'schoolId',
      'secrets',
      'updatedAt',
      'verifiedAt',
      'verifyError',
    ])
  })

  it('stores the address only for a provider whose host it did not compose', async () => {
    const typed = await profiles.replaceProfile(draftFor(schoolId, 'typed'))

    expect(typed.endpoint).toBe('https://de-s3.storage.bunnycdn.com')

    const named = await profiles.replaceProfile({
      ...draftFor(schoolId, 'named'),
      provider: 'bunny',
      endpoint: null,
    })

    expect(named.provider).toBe('bunny')
    expect(named.endpoint).toBeNull()
  })
})
