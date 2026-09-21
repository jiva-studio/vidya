import type {
  BlockId,
  EnrollmentId,
  IsoDateTime,
  LessonVersionId,
  QuizVerdict,
  SchoolId,
  SyncPayload,
} from '@vidya/domain'

import type {
  BlockStateKey,
  IBlockStateRepository,
  IDatabase,
  LocalBlockState,
  SaveBlockState,
} from '../../../ports'
import type { UtcClock } from '../../persistence/migrations'
import { readSyncRows, writeSyncRow } from './rowWriter'

/**
 * Local reads and writes over `block_states` — where the student is inside a
 * lesson: a video's watched position, a quiz answer, a checkbox.
 *
 * Two-way (`SYNC_DIRECTION.block_states === 'both'`): the device writes the
 * answer, the server writes the verdict on it, and neither writes the other's
 * field (`FIELD_OWNER.block_states`).
 *
 * `state` is stored whole as JSON and never inspected. A block type this build
 * has never seen still round-trips, which is the same rule `lesson_versions`
 * follows for an unknown `schemaVersion`.
 *
 * Wrapped by the journal decorator.
 */
export interface SqlBlockStateRepositoryDeps {
  readonly db: IDatabase
  readonly ownerId: () => string
  readonly now: UtcClock
}

export function createSqlBlockStateRepository(
  deps: SqlBlockStateRepositoryDeps,
): IBlockStateRepository {
  const { db, ownerId, now } = deps

  return {
    async getByKey(key: BlockStateKey): Promise<LocalBlockState | null> {
      const payloads = await readSyncRows(
        db,
        ownerId(),
        'block_states',
        'enrollment_id = ? AND lesson_version_id = ? AND block_id = ?',
        [key.enrollmentId, key.lessonVersionId, key.blockId],
      )

      const first = payloads[0]
      return first === undefined ? null : toBlockState(first)
    },

    async listByLessonVersion(
      enrollmentId: EnrollmentId,
      lessonVersionId: LessonVersionId,
    ): Promise<readonly LocalBlockState[]> {
      const payloads = await readSyncRows(
        db,
        ownerId(),
        'block_states',
        'enrollment_id = ? AND lesson_version_id = ?',
        [enrollmentId, lessonVersionId],
        'block_id ASC',
      )

      return payloads.map(toBlockState)
    },

    /**
     * Record progress. Always allowed, offline included — progress is the one
     * thing a student produces continuously, and refusing it would make the
     * lesson screen depend on the network it is meant to survive without.
     */
    async save(input: SaveBlockState): Promise<LocalBlockState> {
      // The row is written whole, so a verdict already on it would be erased by
      // a write that does not name it — and the server, which owns the field,
      // has no reason to send it a second time.
      const marked = await readSyncRows(db, ownerId(), 'block_states', 'id = ?', [input.id])

      const payload: SyncPayload = {
        id: input.id,
        schoolId: input.schoolId,
        enrollmentId: input.enrollmentId,
        lessonVersionId: input.lessonVersionId,
        blockId: input.blockId,
        state: input.state,
        verdict: marked[0]?.verdict ?? null,
        updatedAt: now(),
      }

      await writeSyncRow(
        db,
        { owner: ownerId(), collection: 'block_states', docId: input.id },
        payload,
      )

      return toBlockState(payload)
    },
  }
}

function toBlockState(payload: SyncPayload): LocalBlockState {
  return {
    id: payload.id as string,
    schoolId: payload.schoolId as SchoolId,
    enrollmentId: payload.enrollmentId as EnrollmentId,
    lessonVersionId: payload.lessonVersionId as LessonVersionId,
    blockId: payload.blockId as BlockId,
    state: (payload.state ?? {}) as Record<string, unknown>,
    verdict: (payload.verdict as QuizVerdict | null) ?? null,
    updatedAt: (payload.updatedAt as IsoDateTime) ?? ('' as IsoDateTime),
  }
}
