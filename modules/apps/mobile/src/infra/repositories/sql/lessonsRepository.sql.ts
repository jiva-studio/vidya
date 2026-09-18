import type { CourseId, LessonId, SchoolId, SyncPayload } from '@vidya/domain'

import type { IDatabase, ILessonRepository, LocalLesson } from '@/ports'

import { rowToPayload } from './collectionProjections'
import { readSyncRow, readSyncRows } from './rowWriter'

/**
 * Local reads over `lessons`.
 *
 * Downward-only, like `courses`, so there is nothing to journal here.
 *
 * `listByCourse` answers from `lessons.course_id` alone and never joins
 * `courses`: the two ride the same scope but nothing guarantees the course row
 * arrived first, and a join would hide the lessons of a course whose own row is
 * still in flight (D-13, AC-22h).
 */
export interface SqlLessonRepositoryDeps {
  readonly db: IDatabase
  readonly ownerId: () => string
}

export function createSqlLessonRepository(deps: SqlLessonRepositoryDeps): ILessonRepository {
  const { db, ownerId } = deps

  return {
    async listByCourse(courseId: CourseId): Promise<readonly LocalLesson[]> {
      const payloads = await readSyncRows(
        db,
        ownerId(),
        'lessons',
        'course_id = ?',
        [courseId],
        'lesson_number ASC',
      )

      return payloads.map(toLesson)
    },

    async getById(id: LessonId): Promise<LocalLesson | null> {
      const row = await readSyncRow(db, { owner: ownerId(), collection: 'lessons', docId: id })
      return row === null ? null : toLesson(rowToPayload('lessons', row))
    },
  }
}

function toLesson(payload: SyncPayload): LocalLesson {
  return {
    id: payload.id as LessonId,
    schoolId: payload.schoolId as SchoolId,
    courseId: payload.courseId as CourseId,
    lessonNumber: Number(payload.lessonNumber ?? 0),
    title: (payload.title as string) ?? '',
  }
}
