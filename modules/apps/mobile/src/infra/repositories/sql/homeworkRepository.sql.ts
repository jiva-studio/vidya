import type {
  EnrollmentId,
  HomeworkId,
  HomeworkStatus,
  IsoDateTime,
  LessonVersionId,
  SchoolId,
  SectionId,
  SyncPayload,
  UserId,
} from '@vidya/domain'

import type {
  HomeworkAnswerKey,
  IDatabase,
  IHomeworkRepository,
  LocalHomework,
  SaveHomeworkAnswer,
} from '@/ports'
import { HomeworkFrozenError, isHomeworkEditable, LocalRowNotFoundError } from '@/ports'

import type { UtcClock } from '../../persistence/migrations'
import { rowToPayload } from './collectionProjections'
import { readSyncRow, readSyncRows, writeSyncRow } from './rowWriter'

/**
 * Local reads and writes over `homework`.
 *
 * **The freeze rule lives here** (D-8, AC-22d). The plan says an answer stops
 * being editable once it has been handed in, and until this repository the rule
 * existed only on the server. That gap is not cosmetic: an offline edit after
 * submission would be written, journaled, pushed and then refused as
 * `alreadyAccepted`, and the student would be told off for doing something the
 * app offered them. `saveAnswer` and `submit` both refuse unless the answer is
 * `open` or `returned`, so the refusal happens where the student is, instantly,
 * and without a round trip.
 *
 * The device writes `text` and `submittedAt`; `status`, `grade`, `reviewedById`,
 * `reviewedAt` and `answeredSupersededVersion` are the server's
 * (`FIELD_OWNER.homework`). `submit` is the one place the device touches
 * `status`, and only to request `pending` — the transition the server also
 * allows (`HomeworkTransitions`).
 *
 * Wrapped by the journal decorator, which journals the returned entity in the
 * same transaction as the write.
 */
export interface SqlHomeworkRepositoryDeps {
  readonly db: IDatabase
  readonly ownerId: () => string
  readonly now: UtcClock
}

export function createSqlHomeworkRepository(deps: SqlHomeworkRepositoryDeps): IHomeworkRepository {
  const { db, ownerId, now } = deps

  const read = async (id: HomeworkId): Promise<LocalHomework | null> => {
    const row = await readSyncRow(db, { owner: ownerId(), collection: 'homework', docId: id })
    return row === null ? null : toHomework(rowToPayload('homework', row))
  }

  const store = async (payload: SyncPayload): Promise<LocalHomework> => {
    await writeSyncRow(
      db,
      { owner: ownerId(), collection: 'homework', docId: payload.id as string },
      payload,
    )

    return toHomework(payload)
  }

  return {
    getById: read,

    async getByAnswerKey(key: HomeworkAnswerKey): Promise<LocalHomework | null> {
      const payloads = await readSyncRows(
        db,
        ownerId(),
        'homework',
        'enrollment_id = ? AND lesson_version_id = ? AND section_id = ?',
        [key.enrollmentId, key.lessonVersionId, key.sectionId],
      )

      const first = payloads[0]
      return first === undefined ? null : toHomework(first)
    },

    async listByEnrollment(enrollmentId: EnrollmentId): Promise<readonly LocalHomework[]> {
      const payloads = await readSyncRows(
        db,
        ownerId(),
        'homework',
        'enrollment_id = ?',
        [enrollmentId],
        'created_at ASC',
      )

      return payloads.map(toHomework)
    },

    /**
     * Save the answer's text, creating the answer if this is the first edit.
     *
     * The server-owned fields of an existing answer are carried through
     * untouched: this device does not get an opinion about a grade, and writing
     * a default over one would journal a change that undoes the reviewer's.
     */
    async saveAnswer(input: SaveHomeworkAnswer): Promise<LocalHomework> {
      const existing = await read(input.id)
      if (existing !== null && !isHomeworkEditable(existing.status)) {
        throw new HomeworkFrozenError(existing.status)
      }

      const at = now()
      return store({
        ...(existing === null ? blankAnswer(input, at) : toPayload(existing)),
        text: input.text,
      })
    },

    /**
     * Hand the answer in: `status` moves to `pending` and `submittedAt` is
     * stamped. Refused on an answer that is already in review or accepted, for
     * the same reason `saveAnswer` is.
     */
    async submit(id: HomeworkId, at: IsoDateTime): Promise<LocalHomework> {
      const existing = await read(id)
      if (existing === null) throw new LocalRowNotFoundError('homework', id)
      if (!isHomeworkEditable(existing.status)) throw new HomeworkFrozenError(existing.status)

      return store({
        ...toPayload(existing),
        status: 'pending',
        submittedAt: at,
      })
    },
  }
}

/** A fresh, unanswered row: every server-owned field at its empty value. */
function blankAnswer(input: SaveHomeworkAnswer, at: IsoDateTime): SyncPayload {
  return {
    id: input.id,
    schoolId: input.schoolId,
    enrollmentId: input.enrollmentId,
    lessonVersionId: input.lessonVersionId,
    sectionId: input.sectionId,
    status: 'open',
    text: '',
    grade: null,
    answeredSupersededVersion: false,
    reviewedById: null,
    submittedAt: null,
    reviewedAt: null,
    createdAt: at,
  }
}

function toPayload(homework: LocalHomework): SyncPayload {
  return { ...homework }
}

function toHomework(payload: SyncPayload): LocalHomework {
  return {
    id: payload.id as HomeworkId,
    schoolId: payload.schoolId as SchoolId,
    enrollmentId: payload.enrollmentId as EnrollmentId,
    lessonVersionId: payload.lessonVersionId as LessonVersionId,
    sectionId: payload.sectionId as SectionId,
    status: payload.status as HomeworkStatus,
    text: (payload.text as string) ?? '',
    grade: payload.grade === null || payload.grade === undefined ? null : Number(payload.grade),
    answeredSupersededVersion: payload.answeredSupersededVersion === true,
    reviewedById: (payload.reviewedById as UserId | null) ?? null,
    submittedAt: (payload.submittedAt as IsoDateTime | null) ?? null,
    reviewedAt: (payload.reviewedAt as IsoDateTime | null) ?? null,
    createdAt: (payload.createdAt as IsoDateTime) ?? ('' as IsoDateTime),
  }
}
