import type {
  IsoDateTime,
  LessonContent,
  LessonId,
  LessonVersionId,
  LessonVersionStatus,
  SchoolId,
  SyncPayload,
} from '@vidya/domain'

import type { IDatabase, ILessonVersionRepository, LocalLessonVersion } from '@/ports'

import { rowToPayload } from './collectionProjections'
import { readSyncRow, readSyncRows } from './rowWriter'

/**
 * Local reads over `lesson_versions`.
 *
 * Two things here are not incidental.
 *
 * **Tombstones are honoured, and they do not cascade.** `readSyncRows` filters
 * `deleted_at IS NULL`, so a version withdrawn upstream stops being offered.
 * The homework written against it is in another table and is not touched — a
 * student's work does not disappear because an editor unpublished a draft
 * (D-6, AC-22b). `getById` deliberately still returns a tombstoned row, because
 * an answer that points at it has to be able to say what it was answering.
 *
 * **Content is returned exactly as stored**, `schemaVersion` included, even
 * when this build does not know that version (D-9, AC-22e). Deciding what to do
 * about it belongs to the screen, which offers an update; a repository that
 * filtered here would throw away a lesson the next release can read.
 */
export interface SqlLessonVersionRepositoryDeps {
  readonly db: IDatabase
  readonly ownerId: () => string
}

export function createSqlLessonVersionRepository(
  deps: SqlLessonVersionRepositoryDeps,
): ILessonVersionRepository {
  const { db, ownerId } = deps

  return {
    async getById(id: LessonVersionId): Promise<LocalLessonVersion | null> {
      const row = await readSyncRow(db, {
        owner: ownerId(),
        collection: 'lesson_versions',
        docId: id,
      })

      return row === null ? null : toVersion(rowToPayload('lesson_versions', row))
    },

    /**
     * The highest published version of a lesson the device holds.
     *
     * "Highest", not "the one the server currently calls latest": publishing a
     * new version does not unpublish the old one, and an offline answer written
     * against version 3 has to keep finding version 3 (see AC-10p).
     */
    async getPublished(lessonId: LessonId): Promise<LocalLessonVersion | null> {
      const payloads = await readSyncRows(
        db,
        ownerId(),
        'lesson_versions',
        "lesson_id = ? AND status = 'published'",
        [lessonId],
        'version DESC',
      )

      const first = payloads[0]
      return first === undefined ? null : toVersion(first)
    },
  }
}

function toVersion(payload: SyncPayload): LocalLessonVersion {
  return {
    id: payload.id as LessonVersionId,
    schoolId: payload.schoolId as SchoolId,
    lessonId: payload.lessonId as LessonId,
    version: Number(payload.version ?? 0),
    content: (payload.content ?? {}) as LessonContent,
    status: payload.status as LessonVersionStatus,
    publishedAt: (payload.publishedAt as IsoDateTime | null) ?? null,
  }
}
