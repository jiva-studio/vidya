import type {
  CourseId,
  GroupId,
  GroupStatus,
  IsoDateTime,
  SchoolId,
  SyncPayload,
} from '@vidya/domain'
import { RECRUITING_GROUP_STATUS } from '@vidya/domain'

import type { IDatabase, IGroupRepository, LocalGroup } from '../../../ports'
import { rowToPayload } from './collectionProjections'
import { readSyncRow, readSyncRows } from './rowWriter'

/**
 * Local reads over `groups`.
 *
 * Downward-only, like `courses`: the student never writes a group, so there is
 * nothing to journal here.
 *
 * Recruitment is filtered in the query and nowhere else. Two screens read the
 * list, and a predicate written once per screen is a predicate that will one
 * day disagree with itself about which group is still open. `getById` filters
 * nothing: an accepted student's own group is theirs whatever its status, or
 * the place they hold would disappear the day recruitment closed.
 */
export interface SqlGroupRepositoryDeps {
  readonly db: IDatabase
  readonly ownerId: () => string
}

export function createSqlGroupRepository(deps: SqlGroupRepositoryDeps): IGroupRepository {
  const { db, ownerId } = deps

  return {
    async listRecruitingByCourse(courseId: CourseId): Promise<readonly LocalGroup[]> {
      const payloads = await readSyncRows(
        db,
        ownerId(),
        'groups',
        'course_id = ? AND status = ?',
        [courseId, RECRUITING_GROUP_STATUS],
        'name ASC',
      )

      return payloads.map(toGroup)
    },

    async getById(id: GroupId): Promise<LocalGroup | null> {
      const row = await readSyncRow(db, { owner: ownerId(), collection: 'groups', docId: id })
      return row === null ? null : toGroup(rowToPayload('groups', row))
    },
  }
}

function toGroup(payload: SyncPayload): LocalGroup {
  return {
    id: payload.id as GroupId,
    schoolId: payload.schoolId as SchoolId,
    courseId: payload.courseId as CourseId,
    name: (payload.name as string) ?? '',
    description: (payload.description as string | null) ?? null,
    startsAt: (payload.startsAt as IsoDateTime | null) ?? null,
    status: payload.status as GroupStatus,
  }
}
