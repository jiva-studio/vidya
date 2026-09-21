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
} from '../../../ports'
import { runInTransaction } from '../../persistence/repository'

/**
 * Write-interception for the collections the device writes.
 *
 * A domain repository is wrapped, and every mutating call runs inside one
 * transaction that performs the domain write **and** appends the matching
 * `outbox` row, stamped with an HLC. Either both land or neither does: the
 * student's answer and the record that it needs sending cannot come apart,
 * which is what makes "write offline, sort it out later" a guarantee rather
 * than a hope.
 *
 * Per-collection knowledge lives in `collectionProjections.ts`, so this file is
 * the mechanism and nothing else. There is no reentrant unit of work: every
 * mutating method here is a complete unit, and a sync page never calls one at
 * all — the pull writes through {@link ISyncApplyRepository}, past this
 * decorator, or everything the server sent would be journaled straight back to
 * it.
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

  /** Whose change this is. Read per write, never captured. */
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
    getLiveByCourse: (courseId) => base.enrollments.getLiveByCourse(courseId),

    request: (input) =>
      runInTransaction(deps.db, async () => {
        const saved = await base.enrollments.request(input)
        await journal('enrollments', saved.id, 'upsert', { ...saved })
        return saved
      }),

    // Withdrawal is a change to the row and not its removal: the server writes
    // every tombstone itself and refuses a device that sends one.
    withdraw: (id) =>
      runInTransaction(deps.db, async () => {
        const saved = await base.enrollments.withdraw(id)
        await journal('enrollments', saved.id, 'upsert', { ...saved })
        return saved
      }),

    archive: (id) =>
      runInTransaction(deps.db, async () => {
        const saved = await base.enrollments.archive(id)
        await journal('enrollments', saved.id, 'upsert', { ...saved })
        return saved
      }),

    unarchive: (id) =>
      runInTransaction(deps.db, async () => {
        const saved = await base.enrollments.unarchive(id)
        await journal('enrollments', saved.id, 'upsert', { ...saved })
        return saved
      }),
  }

  const homework: IHomeworkRepository = {
    getById: (id) => base.homework.getById(id),
    getByAnswerKey: (key) => base.homework.getByAnswerKey(key),
    listByEnrollment: (enrollmentId) => base.homework.listByEnrollment(enrollmentId),

    // A refusal from the freeze rule throws out of the transaction, so
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
      // even if the device changes hands before it is sent.
      ownerId: deps.ownerId(),
    })
  }
}

/**
 * The highest stamp this device has issued **or observed**.
 *
 * Both halves are needed. The outbox tail alone is only what this device wrote;
 * a stamp pulled in from another device is just as much part of this clock.
 * Skip it and a device whose wall clock trails another's stamps its edit
 * *below* the change that edit descends from — the server accepts the push, and
 * every device that later pulls both resolves the conflict in favour of the
 * older text.
 *
 * Neither half is read per identity, because an HLC is the clock of a *device*.
 * Seat the counter on the signed-in account instead and it starts again the
 * moment the handset changes hands: the next student's first write is stamped
 * with a string the previous student's first write already carries, and that
 * stamp doubles as the idempotency key of a push.
 */
async function lastSeen(deps: SyncJournalDeps) {
  const journaled = await deps.outbox.latestHlcOnDevice()
  const observed = await deps.apply.latestServerHlcOnDevice()
  const seed = maxHlcString(journaled, observed)

  return seed === null ? null : parseHlc(seed)
}
