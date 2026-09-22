import { testingDataSource } from '@vidya/api/shared/datasources'
import { SchoolId } from '@vidya/domain'
import { School } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { StorageQuotasService } from '../storageQuotas.service'

describe('the ceiling a school stores under', () => {
  let ds: DataSource
  let quotas: StorageQuotasService
  let schoolId: SchoolId
  let otherSchoolId: SchoolId

  beforeEach(async () => {
    ds = await testingDataSource()
    quotas = new StorageQuotasService(ds)

    const school = await ds.getRepository(School).save({ name: 'One', config: {} } as School)
    const other = await ds.getRepository(School).save({ name: 'Two', config: {} } as School)
    schoolId = school.id
    otherSchoolId = other.id
  })

  afterEach(async () => {
    await ds.destroy()
  })

  it('is undecided until somebody sets one', async () => {
    await expect(quotas.findQuotaBytes(schoolId)).resolves.toBeUndefined()
  })

  it('comes back as the number of bytes it was set to', async () => {
    await quotas.setQuotaBytes(schoolId, 53687091200)

    await expect(quotas.findQuotaBytes(schoolId)).resolves.toBe(53687091200)
  })

  // Decided and uncapped is not the same answer as never decided: the first
  // stops the installation default from applying, the second is what asks for
  // it.
  it('tells an uncapped school from one nobody has decided about', async () => {
    await quotas.setQuotaBytes(schoolId, null)

    await expect(quotas.findQuotaBytes(schoolId)).resolves.toBeNull()
    await expect(quotas.findQuotaBytes(otherSchoolId)).resolves.toBeUndefined()
  })

  it('is replaced rather than duplicated when it is set again', async () => {
    await quotas.setQuotaBytes(schoolId, 53687091200)
    await quotas.setQuotaBytes(schoolId, 107374182400)

    await expect(quotas.findQuotaBytes(schoolId)).resolves.toBe(107374182400)

    const rows = await ds.query('SELECT * FROM "school_storage_quotas" WHERE "schoolId" = $1', [
      schoolId,
    ])
    expect(rows).toHaveLength(1)
  })

  it('belongs to one school and is not read for another', async () => {
    await quotas.setQuotaBytes(schoolId, 53687091200)

    await expect(quotas.findQuotaBytes(otherSchoolId)).resolves.toBeUndefined()
  })
})
