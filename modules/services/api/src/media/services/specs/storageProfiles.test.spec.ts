import { testingDataSource } from '@vidya/api/shared/datasources'
import { SchoolId, StorageProfileId } from '@vidya/domain'
import { School, StorageProfile } from '@vidya/entities'
import { randomUUID } from 'crypto'
import { DataSource } from 'typeorm'

import { StorageProfileDraft, StorageProfilesService } from '../storageProfiles.service'

const sealedValue = (fill: number) => ({
  ciphertext: Buffer.alloc(24, fill),
  nonce: Buffer.alloc(12, fill),
})

const draftFor = (schoolId: SchoolId, bucket: string): StorageProfileDraft => ({
  id: randomUUID() as StorageProfileId,
  schoolId,
  kind: 's3',
  endpoint: 'https://de-s3.storage.bunnycdn.com',
  region: 'de',
  bucket,
  prefix: `school/${schoolId}`,
  accessKeyId: 'vidya-demo',
  delivery: 'presigned',
  publicBaseUrl: null,
  video: { kind: 'none' },
  quotaBytes: null,
  sealed: {
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

  it('keeps the sealed values as bytes, so the ciphertext still opens', async () => {
    const draft = draftFor(schoolId, 'first')

    await profiles.replaceProfile(draft)
    const found = await profiles.findCurrentFor(schoolId)

    expect(found?.secretCiphertext?.equals(draft.sealed.secret.ciphertext)).toBe(true)
    expect(found?.secretNonce?.equals(draft.sealed.secret.nonce)).toBe(true)
    expect(found?.dekCiphertext?.equals(draft.sealed.dek.ciphertext)).toBe(true)
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
    expect(retired?.secretCiphertext?.equals(draft.sealed.secret.ciphertext)).toBe(true)
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

  it('starts a new profile with nothing occupied and no quota of our making', async () => {
    const saved = await profiles.replaceProfile(draftFor(schoolId, 'first'))

    expect(Number(saved.usedBytes)).toBe(0)
    expect(saved.quotaBytes).toBeNull()
  })

  it('keeps a quota the school set, as a number a bucket can be measured against', async () => {
    await profiles.replaceProfile({ ...draftFor(schoolId, 'first'), quotaBytes: 53687091200 })

    const found = await profiles.findCurrentFor(schoolId)

    expect(Number(found?.quotaBytes)).toBe(53687091200)
    expect(Number(found?.usedBytes)).toBe(0)
  })
})
