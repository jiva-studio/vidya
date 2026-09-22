import { testDatabase, testingDataSource } from '@vidya/api/shared/datasources'
import { SchoolId } from '@vidya/domain'
import { School } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { StorageQuotasService } from '../storageQuotas.service'

/**
 * What only a real Postgres can say about a `bigint` ceiling.
 *
 * pg-mem hands numbers back as JavaScript numbers whatever the column says, so
 * the loss this asks about cannot happen there and the suite would pass without
 * proving anything.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

// The largest ceiling a JavaScript number carries exactly, and the first one
// above it that it does not. Nine petabytes is past any library, so the answer
// to the second is a refusal rather than a wider type.
const LARGEST_EXACT = String(Number.MAX_SAFE_INTEGER)
const BEYOND_EXACT = '9007199254740993'

describeOnPostgres('a storage ceiling set directly in the database', () => {
  let ds: DataSource
  let quotas: StorageQuotasService
  let schoolId: SchoolId

  beforeEach(async () => {
    ds = await testingDataSource()
    quotas = new StorageQuotasService(ds)

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    schoolId = school.id
  })

  afterEach(async () => {
    await ds.destroy()
  })

  const writeQuota = async (quotaBytes: string | null): Promise<void> => {
    await ds.query(
      'INSERT INTO "school_storage_quotas" ("schoolId", "quotaBytes") VALUES ($1, $2)',
      [schoolId, quotaBytes],
    )
  }

  it('is read back byte for byte at the largest ceiling that can be carried exactly', async () => {
    await writeQuota(LARGEST_EXACT)

    const read = await quotas.findQuotaBytes(schoolId)

    expect(String(read)).toBe(LARGEST_EXACT)
  })

  it('survives the round trip through the service that writes it', async () => {
    await quotas.setQuotaBytes(schoolId, Number.MAX_SAFE_INTEGER)

    const read = await quotas.findQuotaBytes(schoolId)

    expect(String(read)).toBe(LARGEST_EXACT)
  })

  // A ceiling read back as a different number is worse than no answer: nothing
  // downstream can tell it was changed on the way out.
  it('is refused rather than truncated when the stored ceiling cannot be carried exactly', async () => {
    await writeQuota(BEYOND_EXACT)

    await expect(quotas.findQuotaBytes(schoolId)).rejects.toThrow()
  })

  it('is refused when somebody sets a ceiling beyond what can be carried exactly', async () => {
    await expect(quotas.setQuotaBytes(schoolId, Number(BEYOND_EXACT))).rejects.toThrow()
  })

  it('stays absent when nobody has decided, and null when somebody decided not to cap', async () => {
    await expect(quotas.findQuotaBytes(schoolId)).resolves.toBeUndefined()

    await writeQuota(null)

    await expect(quotas.findQuotaBytes(schoolId)).resolves.toBeNull()
  })
})
