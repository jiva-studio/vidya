import type {
  CourseId,
  EnrollmentId,
  EnrollmentStatus,
  IsoDateTime,
  SchoolId,
  SyncPayload,
  UserId,
} from '@vidya/domain'

import type {
  IDatabase,
  IEnrollmentRepository,
  LocalEnrollment,
  NewEnrollmentRequest,
} from '@/ports'
import { LocalRowNotFoundError } from '@/ports'

import type { UtcClock } from '../../persistence/migrations'
import { rowToPayload } from './collectionProjections'
import { deleteSyncRow, readSyncRow, readSyncRows, writeSyncRow } from './rowWriter'

/**
 * Local reads and writes over `enrollments` — a two-way collection: the request
 * goes up, the decision comes down.
 *
 * The device writes `status` and nothing else. `decidedById`, `decidedAt` and
 * `groupId` are the school's (`FIELD_OWNER.enrollments`), and `status` appears
 * in both lists because it means two different things on the two sides: the
 * student asks with `pending`, the school answers with `accepted` or
 * `declined`, and the answer supersedes the request. The merge in
 * `@vidya/domain/sync` is what enforces that; this repository only stores.
 *
 * Withdrawal is a tombstone and stops there. The scope leaves, no new rows
 * arrive for it, and **every row already downloaded stays** —
 * `deleteSyncRow` sets `deleted_at` on this one row and reaches no other table.
 *
 * Wrapped by the journal decorator: both mutating methods are journaled in the
 * transaction that performs them.
 */
export interface SqlEnrollmentRepositoryDeps {
  readonly db: IDatabase
  readonly ownerId: () => string
  readonly now: UtcClock
}

export function createSqlEnrollmentRepository(
  deps: SqlEnrollmentRepositoryDeps,
): IEnrollmentRepository {
  const { db, ownerId, now } = deps

  const read = async (id: EnrollmentId): Promise<LocalEnrollment | null> => {
    const row = await readSyncRow(db, { owner: ownerId(), collection: 'enrollments', docId: id })
    return row === null ? null : toEnrollment(rowToPayload('enrollments', row))
  }

  const require = async (id: EnrollmentId): Promise<LocalEnrollment> => {
    const found = await read(id)
    if (found === null) throw new LocalRowNotFoundError('enrollments', id)
    return found
  }

  return {
    async list(): Promise<readonly LocalEnrollment[]> {
      const payloads = await readSyncRows(db, ownerId(), 'enrollments', '', [], 'created_at ASC')
      return payloads.map(toEnrollment)
    },

    getById: read,

    async getByCourse(courseId: CourseId): Promise<LocalEnrollment | null> {
      const payloads = await readSyncRows(
        db,
        ownerId(),
        'enrollments',
        'course_id = ?',
        [courseId],
        'created_at DESC',
      )

      const first = payloads[0]
      return first === undefined ? null : toEnrollment(first)
    },

    /**
     * Ask to join a course.
     *
     * Unconditional and offline: the row is written and journaled here and now,
     * and whether the school accepts it is a separate question answered later
     * The id is the caller's, so a retry after a crash writes the same
     * document rather than a second request.
     */
    async request(input: NewEnrollmentRequest): Promise<LocalEnrollment> {
      const at = now()
      const payload: SyncPayload = {
        id: input.id,
        schoolId: input.schoolId,
        courseId: input.courseId,
        // The device is signed in as one student and writes every row under
        // that identity, so a request that names nobody is the owner's own.
        studentId: input.studentId ?? ownerId(),
        status: 'pending',
        groupId: null,
        decidedById: null,
        decidedAt: null,
        createdAt: at,
        deletedAt: null,
      }

      await writeSyncRow(
        db,
        { owner: ownerId(), collection: 'enrollments', docId: input.id },
        payload,
      )

      return toEnrollment(payload)
    },

    /** Withdraw the request. The course's downloaded content is left alone. */
    async withdraw(id: EnrollmentId): Promise<LocalEnrollment> {
      const before = await require(id)
      await deleteSyncRow(db, { owner: ownerId(), collection: 'enrollments', docId: id }, now)

      return { ...before, deletedAt: now() }
    },
  }
}

function toEnrollment(payload: SyncPayload): LocalEnrollment {
  return {
    id: payload.id as EnrollmentId,
    schoolId: payload.schoolId as SchoolId,
    courseId: payload.courseId as CourseId,
    groupId: (payload.groupId as string | null) ?? null,
    studentId: payload.studentId as UserId,
    status: payload.status as EnrollmentStatus,
    decidedById: (payload.decidedById as UserId | null) ?? null,
    decidedAt: (payload.decidedAt as IsoDateTime | null) ?? null,
    createdAt: (payload.createdAt as IsoDateTime) ?? ('' as IsoDateTime),
    deletedAt: (payload.deletedAt as IsoDateTime | null) ?? null,
  }
}
