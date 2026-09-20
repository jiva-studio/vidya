import type { IOutboxRepository, ISyncApplyRepository, ISyncStateRepository } from '@vidya/domain'
import {
  createSyncRunner,
  type ISyncClient,
  type ISyncRunner,
  pullAndMerge,
  type PullAndMergeOptions,
  type PullAndMergeResult,
  pushLocal,
  type PushLocalResult,
  type RetryPolicyOptions,
  type SyncEngineDeps,
  SyncPausedError,
  type TokenRefresher,
} from '@vidya/usecases'

import type { UtcClock } from '@/infra/persistence'
import { runInTransaction } from '@/infra/persistence'
import {
  createSqlBlockStateRepository,
  createSqlCourseRepository,
  createSqlEnrollmentRepository,
  createSqlHomeworkRepository,
  createSqlLessonRepository,
  createSqlLessonVersionRepository,
  createSqlOutboxRepository,
  createSqlSchoolRepository,
  createSqlSyncApplyRepository,
  createSqlSyncStateRepository,
  requiredFields,
  withSyncJournaling,
} from '@/infra/repositories'
import {
  DatabaseSuspendedError,
  type IBlockStateRepository,
  type ICourseRepository,
  type IDatabase,
  type IEnrollmentRepository,
  type IHomeworkRepository,
  type ILessonRepository,
  type ILessonVersionRepository,
  type ISchoolRepository,
} from '@/ports'

/**
 * Putting the engine together: adapters below, scenarios above.
 *
 * This is the only file that knows both halves. The scenarios in
 * `@vidya/usecases` are written against ports and could run over anything; the
 * adapters in `@/infra/repositories` know SQLite and nothing else. Everything
 * that has to be decided once — which repositories are journaled, what a unit
 * of work is, where the clock comes from — is decided here, so that a wiring
 * mistake is a compile error in one place rather than a behaviour that differs
 * between two call sites.
 *
 * The four read-only content repositories are returned undecorated: they
 * replicate downward only and the device never writes them. The three writable
 * ones come back wrapped, and nothing hands out the unwrapped versions — a
 * local write that skipped the journal would never be sent, and the student
 * would watch their answer sit on the phone forever.
 */

export interface SyncEngineOptions {
  readonly db: IDatabase
  readonly client: ISyncClient

  /** Stable per-installation id — the HLC tiebreak and the echo-suppression key. */
  readonly deviceId: () => Promise<string>

  /** The signed-in identity. Read per call; it changes under a live engine. */
  readonly ownerId: () => string

  /** Instants as stored and sent: ISO 8601, UTC. */
  readonly now: UtcClock

  /** Wall clock in unix milliseconds — the physical half of an HLC stamp. */
  readonly nowMs: () => number

  /** Jitter source for the retry policy. */
  readonly random: () => number

  readonly refreshToken?: TokenRefresher
  readonly retry?: RetryPolicyOptions
  readonly pullOptions?: Omit<PullAndMergeOptions, 'required'>
}

export interface SyncEngine {
  readonly runner: ISyncRunner

  /**
   * The two halves on their own, outside the lock.
   *
   * Pull-to-refresh only wants the pull; the debounce after a local write only
   * wants the push. Exposing them beats making every caller pay for a full
   * cycle, and it is how a test can state a claim about one half without the
   * other half's failure getting in first.
   */
  pull(): Promise<PullAndMergeResult>
  push(): Promise<PushLocalResult>

  readonly schools: ISchoolRepository
  readonly courses: ICourseRepository
  readonly lessons: ILessonRepository
  readonly lessonVersions: ILessonVersionRepository

  /** Journaled: every write appends an outbox row in the same transaction. */
  readonly enrollments: IEnrollmentRepository
  readonly homework: IHomeworkRepository
  readonly blockStates: IBlockStateRepository

  readonly outbox: IOutboxRepository
  readonly apply: ISyncApplyRepository
  readonly state: ISyncStateRepository
}

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const { db, ownerId, now } = options

  const outbox = createSqlOutboxRepository({ db, now })
  const apply = createSqlSyncApplyRepository({ db, ownerId, now })
  const state = createSqlSyncStateRepository({ db, deviceId: options.deviceId, ownerId })

  const journaled = withSyncJournaling(
    {
      enrollments: createSqlEnrollmentRepository({ db, ownerId, now }),
      homework: createSqlHomeworkRepository({ db, ownerId, now }),
      blockStates: createSqlBlockStateRepository({ db, ownerId, now }),
    },
    { db, outbox, apply, deviceId: options.deviceId, ownerId, nowMs: options.nowMs },
  )

  const engineDeps: SyncEngineDeps = {
    client: options.client,
    outbox,
    apply,
    state,
    unitOfWork: unitOfWorkOver(db),
    get ownerId() {
      return ownerId()
    },
    now,
  }

  const pullOptions: PullAndMergeOptions = { ...options.pullOptions, required: requiredFields }

  const runner = createSyncRunner({
    client: options.client,
    outbox,
    apply,
    state,
    unitOfWork: unitOfWorkOver(db),
    // A getter, not a snapshot: the signed-in identity changes under a live
    // engine, and the adapters below already read it per call. A captured
    // value here would let a run drain one identity's journal under another's
    // name.
    get ownerId() {
      return ownerId()
    },
    now,
    nowMs: options.nowMs,
    random: options.random,
    refreshToken: options.refreshToken,
    retry: options.retry,
    pullOptions,
  })

  return {
    runner,
    pull: () => pullAndMerge(engineDeps, pullOptions),
    push: () => pushLocal(engineDeps),
    schools: createSqlSchoolRepository({ db, ownerId }),
    courses: createSqlCourseRepository({ db, ownerId }),
    lessons: createSqlLessonRepository({ db, ownerId }),
    lessonVersions: createSqlLessonVersionRepository({ db, ownerId }),
    ...journaled,
    outbox,
    apply,
    state,
  }
}

/**
 * One transaction per unit of work, and the translation of a suspended
 * database into the scenario layer's own vocabulary.
 *
 * The scenarios must not import `DatabaseSuspendedError`: it belongs to this
 * app's persistence port, and a scenario that knew it would know which database
 * it was running on. Here it becomes `SyncPausedError`, which the pull and push
 * loops treat as "stop where you are" — every page committed so far stands, and
 * the run resumes from the same scope positions when the app comes back
 *
 */
export function unitOfWorkOver(db: IDatabase) {
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await runInTransaction(db, fn)
    } catch (error) {
      if (error instanceof DatabaseSuspendedError) throw new SyncPausedError()
      throw error
    }
  }
}
