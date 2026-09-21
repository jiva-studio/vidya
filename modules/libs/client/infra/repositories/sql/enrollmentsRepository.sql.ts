import type {
  CourseId,
  EnrollmentId,
  EnrollmentStatus,
  GroupId,
  IsoDateTime,
  PreferredTimes,
  SchoolId,
  SyncPayload,
  UserId,
} from '@vidya/domain'
import { LiveEnrollmentStatuses } from '@vidya/domain'

import type {
  IDatabase,
  IEnrollmentRepository,
  LocalEnrollment,
  NewEnrollmentRequest,
} from '../../../ports'
import { LocalRowNotFoundError } from '../../../ports'
import type { UtcClock } from '../../persistence/migrations'
import { rowToPayload } from './collectionProjections'
import { readSyncRow, readSyncRows, writeSyncRow } from './rowWriter'

/**
 * Local reads and writes over `enrollments` — a two-way collection: the request
 * goes up, the decision comes down.
 *
 * The device writes `status`, the three preferences and `archivedByStudentAt`.
 * `decidedById`, `decidedAt` and `groupId` are the school's
 * (`FIELD_OWNER.enrollments`), and `status` appears in both lists because it
 * means two different things on the two sides: the student asks with
 * `pending`, the school answers with `accepted` or `declined`, and the answer
 * supersedes the request. The merge in `@vidya/domain/sync` is what enforces
 * that; this repository only stores.
 *
 * Nothing here writes a tombstone. A request that ends says so in its status,
 * and a course keeps every request ever made for it, so a screen asking "does
 * this student hold a place" asks {@link IEnrollmentRepository.getLiveByCourse}
 * and not for the newest row.
 *
 * Every field the device owns is written by name on every write, `null`
 * included: a field the payload leaves out is a field the merge deletes, so an
 * empty stamp has to travel as an explicit `null`.
 *
 * Wrapped by the journal decorator: every mutating method is journaled in the
 * transaction that performs it.
 */
export interface SqlEnrollmentRepositoryDeps {
  readonly db: IDatabase
  readonly ownerId: () => string
  readonly now: UtcClock
}

/** Hidden when the student put the row away and it is no longer live. */
const VISIBLE = `(archived_by_student_at IS NULL OR status IN (${LiveEnrollmentStatuses.map(
  () => '?',
).join(', ')}))`

const LIVE = `status IN (${LiveEnrollmentStatuses.map(() => '?').join(', ')})`

const LIVE_STATUSES = [...LiveEnrollmentStatuses]

export function createSqlEnrollmentRepository(
  deps: SqlEnrollmentRepositoryDeps,
): IEnrollmentRepository {
  const { db, ownerId, now } = deps

  const read = async (id: EnrollmentId): Promise<SyncPayload | null> => {
    const row = await readSyncRow(db, { owner: ownerId(), collection: 'enrollments', docId: id })
    return row === null ? null : rowToPayload('enrollments', row)
  }

  const save = async (id: EnrollmentId, changes: SyncPayload): Promise<LocalEnrollment> => {
    const stored = await read(id)
    if (stored === null) throw new LocalRowNotFoundError('enrollments', id)

    const payload: SyncPayload = { ...stored, ...changes, id }
    await writeSyncRow(db, { owner: ownerId(), collection: 'enrollments', docId: id }, payload)

    return toEnrollment(payload)
  }

  return {
    async list(): Promise<readonly LocalEnrollment[]> {
      const payloads = await readSyncRows(
        db,
        ownerId(),
        'enrollments',
        VISIBLE,
        LIVE_STATUSES,
        'created_at ASC',
      )

      return payloads.map(toEnrollment)
    },

    async getById(id: EnrollmentId): Promise<LocalEnrollment | null> {
      const payload = await read(id)
      return payload === null ? null : toEnrollment(payload)
    },

    async getLiveByCourse(courseId: CourseId): Promise<LocalEnrollment | null> {
      const payloads = await readSyncRows(
        db,
        ownerId(),
        'enrollments',
        `course_id = ? AND ${LIVE}`,
        [courseId, ...LIVE_STATUSES],
        'created_at DESC',
      )

      const first = payloads[0]
      return first === undefined ? null : toEnrollment(first)
    },

    /**
     * Ask to join a course.
     *
     * Unconditional and offline: the row is written and journaled here and now,
     * and whether the school accepts it is a separate question answered later.
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
        preferredGroupId: input.preferredGroupId ?? null,
        preferredTimes: input.preferredTimes ?? null,
        comment: input.comment ?? null,
        archivedByStudentAt: null,
      }

      await writeSyncRow(
        db,
        { owner: ownerId(), collection: 'enrollments', docId: input.id },
        payload,
      )

      return toEnrollment(payload)
    },

    /**
     * Hand the request back.
     *
     * One write ends the request and puts it away: a student who withdrew has
     * no more to read, and the row would otherwise sit in their list waiting
     * to be dismissed a second time.
     */
    withdraw(id: EnrollmentId): Promise<LocalEnrollment> {
      return save(id, { status: 'withdrawn', archivedByStudentAt: now() })
    },

    archive(id: EnrollmentId): Promise<LocalEnrollment> {
      return save(id, { archivedByStudentAt: now() })
    },

    unarchive(id: EnrollmentId): Promise<LocalEnrollment> {
      return save(id, { archivedByStudentAt: null })
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
    preferredGroupId: (payload.preferredGroupId as GroupId | null) ?? null,
    preferredTimes: (payload.preferredTimes as PreferredTimes | null) ?? null,
    comment: (payload.comment as string | null) ?? null,
    archivedByStudentAt: (payload.archivedByStudentAt as IsoDateTime | null) ?? null,
  }
}
