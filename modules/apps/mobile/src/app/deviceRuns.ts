import type { SyncRunResult } from '@vidya/usecases'

import type { IDatabase } from '@/ports'

/**
 * One queue of sync runs per database, and the way the lock is given back.
 *
 * Every connection has its own engine, and every engine writes to the same
 * SQLite file. Two runs overlapping there are two transactions on one
 * connection — `database is locked` at best, and at worst one run draining the
 * journal another has already sent. So the runs of a database are queued, and
 * the queue is the only place that knows how many connections there are.
 *
 * **Going into the background does not wait for the queue.** iOS kills an app
 * that still holds a SQLite lock when it is suspended, and that death happens
 * on a student's handset and never in our logs. The page already fetched is
 * carried to its commit — dropping it would repeat the download — and every run
 * still waiting is cancelled rather than started behind it.
 */

export interface DeviceRuns {
  /**
   * The database the engines write through.
   *
   * The same file, wrapped so the queue can tell when a page has reached its
   * commit and the lock is free to give back.
   */
  readonly db: IDatabase

  /** Queues a run, or answers `paused` when the device took the database back. */
  run(cycle: () => Promise<SyncRunResult>): Promise<SyncRunResult>

  /** Cancels what is queued, lets the page in flight commit, releases the lock. */
  suspend(): Promise<void>

  /**
   * `true` from the moment the device asked for the database back.
   *
   * Read before anything leaves the handset, not only before a write: the run
   * in flight is allowed to commit the page it already holds, and a request for
   * the next one would be made by an app the system is putting to sleep, for an
   * answer there is no longer a lock to write.
   */
  isSuspended(): boolean

  resume(): void

  /** Counts the engines over this database; the last one to leave releases the lock. */
  attach(): void
  detach(): Promise<void>
}

const paused = (): SyncRunResult => ({
  outcome: 'paused',
  push: null,
  pull: null,
  resynced: [],
  retryAfterMs: null,
  failure: null,
})

const queues = new WeakMap<IDatabase, DeviceRuns>()

/** The queue of a database, created once and shared by every engine over it. */
export function deviceRunsFor(database: IDatabase): DeviceRuns {
  const existing = queues.get(database)
  if (existing !== undefined) return existing

  const created = createDeviceRuns(database)
  queues.set(database, created)

  return created
}

function createDeviceRuns(database: IDatabase): DeviceRuns {
  let queue: Promise<unknown> = Promise.resolve()
  let inFlight: Promise<SyncRunResult> | null = null
  let openTransaction: Promise<void> | null = null
  let committed: (() => void) | null = null
  let suspended = false
  let engines = 0

  const waiting = new Set<{ cancelled: boolean }>()

  const db: IDatabase = {
    ...database,
    transaction: (block: () => Promise<void>) => {
      const running = database.transaction(block)
      const settled = running.then(
        () => undefined,
        () => undefined,
      )

      openTransaction = settled
      void settled.then(() => {
        if (openTransaction === settled) openTransaction = null
        const waiter = committed
        committed = null
        waiter?.()
      })

      return running
    },
  }

  /**
   * Resolves when the work already under way has reached a commit.
   *
   * Raced against the run itself, because a run that is between pages has no
   * transaction to wait for and one that failed will never open another. The
   * lock is not held while waiting: SQLite takes it inside a transaction, and
   * this is what the one in progress is allowed to finish.
   */
  const pageInFlight = async (): Promise<void> => {
    const running = inFlight
    if (running === null) return

    const commit = openTransaction ?? new Promise<void>((resolve) => (committed = resolve))
    await Promise.race([commit, running.then(() => undefined)])
  }

  const run = (cycle: () => Promise<SyncRunResult>): Promise<SyncRunResult> => {
    const queued = { cancelled: false }
    waiting.add(queued)

    const task = queue.then(async () => {
      waiting.delete(queued)
      if (queued.cancelled || suspended) return paused()

      const running = cycle()
      inFlight = running
      try {
        return await running
      } finally {
        if (inFlight === running) inFlight = null
      }
    })

    queue = task.then(
      () => undefined,
      () => undefined,
    )

    return task
  }

  const suspend = (): Promise<void> => {
    suspended = true
    for (const queued of waiting) queued.cancelled = true

    // Nothing is under way: the lock goes back in this turn rather than after
    // an await, so a database suspended on the way into the background is
    // suspended by the time the platform's handler returns.
    if (inFlight === null) return database.suspend()

    return settleThenSuspend()
  }

  const settleThenSuspend = async (): Promise<void> => {
    await pageInFlight()
    await database.suspend()
  }

  const resume = (): void => {
    suspended = false
    database.resume()
  }

  const attach = (): void => {
    if (engines === 0) resume()
    engines += 1
  }

  const detach = async (): Promise<void> => {
    engines = Math.max(0, engines - 1)
    if (engines === 0) await suspend()
  }

  return { db, run, suspend, resume, attach, detach, isSuspended: () => suspended }
}
