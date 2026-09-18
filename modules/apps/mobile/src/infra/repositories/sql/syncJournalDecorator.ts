import {
  hlcNow,
  hlcToString,
  type IOutboxRepository,
  type ISyncApplyRepository,
  maxHlcString,
  parseHlc,
  type SyncCollection,
  type SyncOp,
  type SyncPayload,
} from '@vidya/domain'

import type {
  IBlockStateRepository,
  IDatabase,
  IEnrollmentRepository,
  IHomeworkRepository,
} from '@/ports'

import { runInTransaction } from '../../persistence/repository'

/**
 * Write-interception for the collections the device writes.
 *
 * This is the mechanism the whole stage turns on. A domain repository is
 * wrapped, and every mutating call is run inside one transaction that performs
 * the domain write **and** appends the matching `outbox` row, stamped with an
 * HLC. Either both land or neither does (AC-15, T-M-5). The student's answer
 * and the record that it needs sending cannot come apart, which is what makes
 * "write offline, sort it out later" a guarantee rather than a hope.
 *
 * Copied in shape from Lectorium's `infra/repositories/sql/syncJournalDecorator.ts`
 * (549 lines there). Two departures:
 *
 * - The per-collection knowledge is in `collectionProjections.ts`, so this file
 *   is the mechanism and nothing else. That is what keeps it inside the 350-line
 *   ceiling with room to spare.
 * - There is no reentrant unit of work. Every mutating method here is a
 *   complete unit: the screens call one at a time, and a sync page never calls
 *   one at all — the pull writes through {@link ISyncApplyRepository}, past
 *   this decorator, or everything the server sent would be journaled straight
 *   back to it (AC-16, T-M-6).
 *
 * Each decorated repository is written out **member by member**, never as a
 * spread of the base. A spread satisfies the interface structurally, so a
 * mutating method added later would compile un-journaled and ship silently;
 * with the literal, a new member is a compile error until someone decides
 * whether it is journaled.
 */

export interface SyncJournalDeps {
  /** The same connection the wrapped repositories write through. */
  readonly db: IDatabase

  /** Where the journal row goes. Joins the transaction opened here. */
  readonly outbox: IOutboxRepository

  /**
   * The HLC pointers the pull has recorded. Read for two things: the seed of
   * the next stamp, and the `baseHlc` a change declares it descends from.
   */
  readonly apply: ISyncApplyRepository

  /** This installation's stable id — the HLC's final tiebreak. */
  readonly deviceId: () => Promise<string>

  /** Whose change this is. Read per write, never captured (AC-20, T-I-3). */
  readonly ownerId: () => string

  /** Wall clock in unix milliseconds, injected so a test can pin it. */
  readonly nowMs: () => number
}

/** The repositories that carry local writes, and so need journaling. */
export interface JournaledRepositories {
  readonly enrollments: IEnrollmentRepository
  readonly homework: IHomeworkRepository
  readonly blockStates: IBlockStateRepository
}

/**
 * Wrap the writable repositories so every mutation is journaled atomically.
 *
 * `courses`, `lessons` and `lesson_versions` are absent on purpose: they
 * replicate downward only, the device never writes them, and a decorator over
 * them would be a place for a write to appear later without anyone noticing.
 */
export function withSyncJournaling(
  base: JournaledRepositories,
  deps: SyncJournalDeps,
): JournaledRepositories {
  const journal = createJournal(deps)

  const enrollments: IEnrollmentRepository = {
    list: () => base.enrollments.list(),
    getById: (id) => base.enrollments.getById(id),
    getByCourse: (courseId) => base.enrollments.getByCourse(courseId),

    request: (input) =>
      runInTransaction(deps.db, async () => {
        const saved = await base.enrollments.request(input)
        await journal('enrollments', saved.id, 'upsert', { ...saved })
        return saved
      }),

    withdraw: (id) =>
      runInTransaction(deps.db, async () => {
        const saved = await base.enrollments.withdraw(id)
        await journal('enrollments', saved.id, 'delete', null)
        return saved
      }),
  }

  const homework: IHomeworkRepository = {
    getById: (id) => base.homework.getById(id),
    getByAnswerKey: (key) => base.homework.getByAnswerKey(key),
    listByEnrollment: (enrollmentId) => base.homework.listByEnrollment(enrollmentId),

    // A refusal from the freeze rule (D-8) throws out of the transaction, so
    // nothing is written and nothing is journaled — the edit never happened.
    saveAnswer: (input) =>
      runInTransaction(deps.db, async () => {
        const saved = await base.homework.saveAnswer(input)
        await journal('homework', saved.id, 'upsert', { ...saved })
        return saved
      }),

    submit: (id, at) =>
      runInTransaction(deps.db, async () => {
        const saved = await base.homework.submit(id, at)
        await journal('homework', saved.id, 'upsert', { ...saved })
        return saved
      }),
  }

  const blockStates: IBlockStateRepository = {
    getByKey: (key) => base.blockStates.getByKey(key),
    listByLessonVersion: (enrollmentId, lessonVersionId) =>
      base.blockStates.listByLessonVersion(enrollmentId, lessonVersionId),

    save: (input) =>
      runInTransaction(deps.db, async () => {
        const saved = await base.blockStates.save(input)
        await journal('block_states', saved.id, 'upsert', { ...saved })
        return saved
      }),
  }

  return { enrollments, homework, blockStates }
}

/** Appends one journal row. Runs inside the caller's transaction, always. */
type Journal = (
  collection: SyncCollection,
  docId: string,
  op: SyncOp,
  data: SyncPayload | null,
) => Promise<void>

function createJournal(deps: SyncJournalDeps): Journal {
  return async (collection, docId, op, data) => {
    const deviceId = await deps.deviceId()
    const hlc = hlcToString(hlcNow(deviceId, await lastSeen(deps), deps.nowMs()))

    await deps.outbox.append({
      collection,
      docId,
      op,
      data,
      hlc,
      // What the change descends from, as far as this device knows. The server
      // uses it to tell an edit of the version it holds from an edit of one
      // two revisions old.
      baseHlc: await deps.apply.lastServerHlc(collection, docId),
      // Stamped explicitly, so the row stays with the identity that wrote it
      // even if the device changes hands before it is sent (T-I-3).
      ownerId: deps.ownerId(),
    })
  }
}

/**
 * The highest stamp this device has issued **or observed**.
 *
 * Both halves are needed, and the second one is the easy one to forget. The
 * outbox tail alone is only what we wrote; a stamp pulled in from another
 * device is just as much part of this clock. Skip it and a device whose wall
 * clock trails another's stamps its edit *below* the change that edit descends
 * from — the server accepts the push, and every device that later pulls both
 * resolves the conflict in favour of the older text.
 *
 * Neither half is read per identity, and that is the whole of D-7. An HLC is
 * the clock of a *device*: the `device_id` it ends with is this installation's,
 * and the counter before it is what keeps two writes of the same millisecond
 * apart. Seat that counter on the signed-in account and it starts again the
 * moment the handset changes hands — the next student's first write is stamped
 * with a string the previous student's first write already carries, and the
 * stamp doubles as the idempotency key of a push. Every row on this disk was
 * written by this one device, so every row on this disk is its clock.
 */
async function lastSeen(deps: SyncJournalDeps) {
  const journaled = await deps.outbox.latestHlcOnDevice()
  const observed = await deps.apply.latestServerHlcOnDevice()
  const seed = maxHlcString(journaled, observed)

  return seed === null ? null : parseHlc(seed)
}
