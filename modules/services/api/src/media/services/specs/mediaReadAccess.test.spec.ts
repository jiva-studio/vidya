import { UserAuthentication } from '@vidya/api/auth/utils'
import * as domain from '@vidya/domain'
import { Media } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { MediaReadAccessService } from '../mediaReadAccess.service'

const READER = '4d1e1a2b-0000-4000-8000-00000000000f' as domain.UserId

/** A reader who holds nothing, so nothing is readable by permission. */
const stranger = (): Pick<UserAuthentication, 'userId' | 'permissions'> =>
  ({
    userId: READER,
    permissions: { has: () => false },
  }) as unknown as Pick<UserAuthentication, 'userId' | 'permissions'>

/**
 * A datasource that answers nothing and counts what it was asked.
 *
 * The guard on an empty batch is invisible through the answer — `IN ()` selects
 * nothing either way — so the only thing that can tell the two apart is whether
 * the database was spoken to at all.
 */
const countingDataSource = () => {
  const queries: string[] = []

  const repository = {
    async find(): Promise<Media[]> {
      queries.push('find')
      return []
    },
    createQueryBuilder() {
      queries.push('createQueryBuilder')
      throw new Error('this suite has no student coursework to read')
    },
  }

  return { queries, dataSource: { getRepository: () => repository } as unknown as DataSource }
}

describe('which of the asked-for files a caller may be given', () => {
  it('asks the database nothing at all for an empty batch', async () => {
    const { queries, dataSource } = countingDataSource()

    const readable = await new MediaReadAccessService(dataSource).findReadable([], stranger())

    expect(readable).toEqual([])
    expect(queries).toEqual([])
  })

  it('asks the database once for a batch that names a file', async () => {
    const { queries, dataSource } = countingDataSource()
    const id = '11111111-1111-4111-8111-111111111111' as domain.MediaId

    const readable = await new MediaReadAccessService(dataSource).findReadable([id], stranger())

    expect(readable).toEqual([])
    expect(queries).toEqual(['find'])
  })
})
