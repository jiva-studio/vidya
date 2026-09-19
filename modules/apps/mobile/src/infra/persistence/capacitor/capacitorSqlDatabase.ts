import type { SQLiteDBConnection } from '@capacitor-community/sqlite'

import { DatabaseSuspendedError, type IDatabase, type QueryParams } from '@/ports'

/**
 * The part of the plugin's connection this adapter uses.
 *
 * Narrowed from {@link SQLiteDBConnection} rather than taking the class, for
 * two reasons. It states exactly what the adapter depends on, and it lets the
 * conformance suite drive the adapter against a stand-in connection — this code
 * had never been executed at all before that, on a device or anywhere else.
 *
 * `close` is deliberately absent: see {@link createCapacitorSqlDatabase}.
 */
export type CapacitorConnection = Pick<
  SQLiteDBConnection,
  | 'query'
  | 'run'
  | 'beginTransaction'
  | 'commitTransaction'
  | 'rollbackTransaction'
  | 'isTransactionActive'
>

/**
 * Wraps an open `@capacitor-community/sqlite` connection in the app's
 * {@link IDatabase} port.
 *
 * Logic follows `apps/mobile/infra/persistence/capacitor/useCapacitorSqlPersistence.ts`
 * in lectorium, reduced to the one writable database this app has and extended
 * with suspend/resume for the background-lock problem below.
 *
 * **Closing is `release` and nothing else.** The plugin's `closeConnection`
 * closes the database and then drops it from its registry, so calling
 * `db.close()` first asked it to close a database it was about to close again —
 * harmless today only because nothing signs out yet.
 */
export function createCapacitorSqlDatabase(
  db: CapacitorConnection,
  release: () => Promise<void>,
): IDatabase {
  // SQLite has no nested transactions, and this is one connection: two
  // overlapping blocks would BEGIN inside an open transaction. Serialise them
  // through a promise chain so each runs atomically end to end. `execute` is
  // deliberately not queued — repositories call it from inside a block, and
  // routing it through the same chain would deadlock.
  let txQueue: Promise<unknown> = Promise.resolve()

  let suspended = false

  async function runBlock(fn: () => Promise<void>): Promise<void> {
    await healOpenTransaction()
    await db.beginTransaction()

    try {
      await fn()
      await db.commitTransaction()
    } catch (error) {
      await rollbackAfterFailure()
      throw error
    }
  }

  /**
   * Roll back a transaction a previous block could not.
   *
   * A rollback can fail on the device — this is one connection to a real file,
   * not an in-memory image — and a failed rollback leaves the transaction open.
   * Without this, every later block would hit "cannot start a transaction
   * within a transaction" until the app was restarted: one failed write, and
   * the database is dead for the rest of the session. sql.js will never show
   * that, which is precisely why it went unnoticed.
   *
   * A failure here is not swallowed. If the transaction is open and cannot be
   * rolled back, the caller is told before any work is attempted, rather than
   * finding out from a BEGIN that cannot explain itself.
   */
  async function healOpenTransaction(): Promise<void> {
    const { result } = await db.isTransactionActive()
    if (result !== true) return

    await db.rollbackTransaction()
  }

  async function rollbackAfterFailure(): Promise<void> {
    try {
      await db.rollbackTransaction()
    } catch {
      // The caller is owed the error that broke the block, not the one from
      // cleaning up after it. The transaction this failed to close is not left
      // to poison the connection: the next block rolls it back first.
    }
  }

  return {
    async query<T = unknown>(sql: string, params?: QueryParams): Promise<T[]> {
      const result = await db.query(sql, params as unknown[])
      return (result.values ?? []) as T[]
    },

    async execute(sql: string, params?: QueryParams): Promise<void> {
      await db.run(sql, params as unknown[], false)
    },

    async transaction(fn: () => Promise<void>): Promise<void> {
      if (suspended) throw new DatabaseSuspendedError()

      const next = txQueue.then(() => runBlock(fn))

      // Keep the queue alive after a failed block so the next caller does not
      // inherit the rejection.
      txQueue = next.catch(() => undefined)
      await next
    },

    // COMMIT is durability here: the plugin writes to a real file, so there is
    // no image to export. That is true on a native platform and only there,
    // which is why `useCapacitorSqlPersistence` refuses to open anywhere else
    // rather than leaving this method to lose data quietly.
    async save(): Promise<void> {},

    async suspend(): Promise<void> {
      // iOS kills an app that still holds a SQLite lock when it is suspended
      // (0xdead10cc), and that death lands on a student's phone rather than in
      // our logs. Refuse new blocks, wait for the one in flight to commit or
      // roll back, and the lock is gone. Nothing is lost: the work
      // above resumes from positions that are already durable.
      suspended = true
      await txQueue.catch(() => undefined)
    },

    resume(): void {
      suspended = false
    },

    async close(): Promise<void> {
      await release()
    },
  }
}
