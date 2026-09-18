import type { SQLiteDBConnection } from '@capacitor-community/sqlite'

import { DatabaseSuspendedError, type IDatabase, type QueryParams } from '@/ports'

/**
 * Wraps an open `@capacitor-community/sqlite` connection in the app's
 * {@link IDatabase} port.
 *
 * Logic follows `apps/mobile/infra/persistence/capacitor/useCapacitorSqlPersistence.ts`
 * in lectorium, reduced to the one writable database this app has and extended
 * with suspend/resume for the background-lock problem below.
 *
 * `release` is called on {@link IDatabase.close} to hand the connection back to
 * the plugin.
 */
export function createCapacitorSqlDatabase(
  db: SQLiteDBConnection,
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
    await db.beginTransaction()
    try {
      await fn()
      await db.commitTransaction()
    } catch (error) {
      await rollbackQuietly()
      throw error
    }
  }

  async function rollbackQuietly(): Promise<void> {
    try {
      await db.rollbackTransaction()
    } catch {
      // A rollback can fail on its own — the connection may already be gone —
      // and letting that surface would hide the error that broke the block.
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
    // no image to export. The method stays because the port has it and the
    // sql.js adapter genuinely needs it.
    async save(): Promise<void> {},

    async suspend(): Promise<void> {
      // iOS kills an app that still holds a SQLite lock when it is suspended
      // (0xdead10cc), and that death lands on a student's phone rather than in
      // our logs. Refuse new blocks, wait for the one in flight to commit or
      // roll back, and the lock is gone (D-14). Nothing is lost: the work
      // above resumes from positions that are already durable.
      suspended = true
      await txQueue.catch(() => undefined)
    },

    resume(): void {
      suspended = false
    },

    async close(): Promise<void> {
      await db.close()
      await release()
    },
  }
}
