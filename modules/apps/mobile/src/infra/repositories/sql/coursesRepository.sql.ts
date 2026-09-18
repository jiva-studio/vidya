import type { CourseId, CourseLearningType, SchoolId, SyncPayload } from '@vidya/domain'

import type { ICourseRepository, IDatabase, LocalCourse } from '@/ports'

import { rowToPayload } from './collectionProjections'
import { readSyncRow, readSyncRows } from './rowWriter'

/**
 * Local reads over `courses`.
 *
 * `courses` replicates downward only (`SYNC_DIRECTION.courses === 'down'`), so
 * this repository has no writes at all and is not wrapped by the journal
 * decorator. A course the device holds is readable unconditionally, including
 * after the student was withdrawn from it (D-7): nothing here filters on
 * enrolment, because reading what was downloaded is not a permission question.
 */
export interface SqlCourseRepositoryDeps {
  readonly db: IDatabase
  readonly ownerId: () => string
}

export function createSqlCourseRepository(deps: SqlCourseRepositoryDeps): ICourseRepository {
  const { db, ownerId } = deps

  return {
    async list(): Promise<readonly LocalCourse[]> {
      const payloads = await readSyncRows(db, ownerId(), 'courses', '', [], 'name ASC')
      return payloads.map(toCourse)
    },

    async getById(id: CourseId): Promise<LocalCourse | null> {
      const row = await readSyncRow(db, { owner: ownerId(), collection: 'courses', docId: id })
      return row === null ? null : toCourse(rowToPayload('courses', row))
    },
  }
}

function toCourse(payload: SyncPayload): LocalCourse {
  return {
    id: payload.id as CourseId,
    schoolId: payload.schoolId as SchoolId,
    name: (payload.name as string) ?? '',
    description: (payload.description as string | null) ?? null,
    learningType: payload.learningType as CourseLearningType,
  }
}
