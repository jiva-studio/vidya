import type { SchoolId, SyncPayload } from '@vidya/domain'

import type { IDatabase, ISchoolRepository, LocalSchool } from '../../../ports'
import { rowToPayload } from './collectionProjections'
import { readSyncRow, readSyncRows } from './rowWriter'

/**
 * Local reads over `schools`.
 *
 * `schools` replicates downward only, so this repository has no writes and is
 * not wrapped by the journal decorator. A school the device holds is readable
 * unconditionally: nothing here filters on membership, because reading what was
 * downloaded is not a permission question.
 */
export interface SqlSchoolRepositoryDeps {
  readonly db: IDatabase
  readonly ownerId: () => string
}

export function createSqlSchoolRepository(deps: SqlSchoolRepositoryDeps): ISchoolRepository {
  const { db, ownerId } = deps

  return {
    async list(): Promise<readonly LocalSchool[]> {
      const payloads = await readSyncRows(db, ownerId(), 'schools', '', [], 'name ASC')
      return payloads.map(toSchool)
    },

    async getById(id: SchoolId): Promise<LocalSchool | null> {
      const row = await readSyncRow(db, { owner: ownerId(), collection: 'schools', docId: id })
      return row === null ? null : toSchool(rowToPayload('schools', row))
    },

    async getByCode(code: string): Promise<LocalSchool | null> {
      const payloads = await readSyncRows(db, ownerId(), 'schools', 'code = ?', [code], 'name ASC')
      return payloads.length === 0 ? null : toSchool(payloads[0])
    },
  }
}

function toSchool(payload: SyncPayload): LocalSchool {
  return {
    id: payload.id as SchoolId,
    name: (payload.name as string) ?? '',
    logoUrl: (payload.logoUrl as string | null) ?? null,
    description: (payload.description as string | null) ?? null,
    code: (payload.code as string | null) ?? null,
  }
}
