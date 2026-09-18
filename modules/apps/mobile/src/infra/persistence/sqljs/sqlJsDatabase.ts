import type { Database } from 'sql.js'

import { DatabaseSuspendedError, type IDatabase, type QueryParams } from '@/ports'

/**
 * Makes an exported sql.js image durable. A test keeps the bytes in memory; a
 * browser would hand them to IndexedDB.
 */
export type PersistSink = (data: Uint8Array) => Promise<void>

/**
 * Wraps an open sql.js {@link Database} in the app's {@link IDatabase} port.
 *
 * Logic copied from `apps/mobile/infra/persistence/sqljs/sqlJsDatabase.ts` in
 * lectorium, minus the `PRAGMA foreign_keys` line: the device schema has no
 * foreign keys at all (D-13), so there is nothing to switch on.
 *
 * Split out from the factory so the durability rules below can be exercised
 * without a browser — which is the whole point of this adapter. It exists to
 * run the sync engine against real SQL with no device and no emulator, not to
 * ship the app on the web.
 */
export function createSqlJsDatabase(db: Database, persist: PersistSink): IDatabase {
  // SQLite has no nested transactions: two overlapping BEGINs on one
  // connection fail with "cannot start a transaction within a transaction".
  // Serialise transaction blocks through a promise chain so each one runs
  // atomically end to end. `execute` deliberately skips the queue — repos call
  // it from inside `fn`, so routing it through the same chain would deadlock.
  let txQueue: Promise<unknown> = Promise.resolve()

  // While a block is open, `save` is deferred: exporting mid-transaction
  // closes and reopens the database underneath the open transaction.
  let inTransaction = false
  let saveDeferred = false

  // Whether any statement has run since the last export. A committed
  // transaction persists whenever it wrote something, not only when someone
  // remembered to call `save`.
  let dirty = false

  let savePromise: Promise<void> = Promise.resolve()

  // Set by `suspend` so the lock is released before the app is backgrounded.
  let suspended = false

  async function persistNow(): Promise<void> {
    dirty = false
    const data = db.export()
    await persist(data)
  }

  // Coalesce concurrent saves rather than racing two exports of the same image.
  function scheduleSave(): Promise<void> {
    savePromise = savePromise.then(persistNow, persistNow)
    return savePromise
  }

  async function runBlock(fn: () => Promise<void>): Promise<void> {
    // A failed BEGIN leaves no transaction open, so a blanket ROLLBACK would
    // itself throw "no transaction is active". Track what actually started.
    let started = false
    saveDeferred = false

    try {
      db.run('BEGIN')
      started = true
      inTransaction = true
      await fn()
      db.run('COMMIT')
    } catch (error) {
      if (started) rollbackQuietly()
      saveDeferred = false
      throw error
    } finally {
      inTransaction = false
    }

    if (saveDeferred || dirty) {
      saveDeferred = false
      await scheduleSave()
    }
  }

  function rollbackQuietly(): void {
    try {
      db.run('ROLLBACK')
    } catch {
      // The caller wants the error that broke the block, not the one from
      // cleaning up after it.
    }
  }

  return {
    async query<T = unknown>(sql: string, params?: QueryParams): Promise<T[]> {
      const stmt = db.prepare(sql)
      if (params?.length) stmt.bind(params as never)

      const rows: T[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as T)

      stmt.free()
      return rows
    },

    async execute(sql: string, params?: QueryParams): Promise<void> {
      db.run(sql, params as never)
      dirty = true
    },

    async transaction(fn: () => Promise<void>): Promise<void> {
      if (suspended) throw new DatabaseSuspendedError()

      const next = txQueue.then(() => runBlock(fn))

      // Keep the queue alive after a failed block so the next caller does not
      // inherit the rejection.
      txQueue = next.catch(() => undefined)
      await next
    },

    async save(): Promise<void> {
      if (inTransaction) {
        // The wrapping block exports once after COMMIT; exporting here would
        // tear down the transaction that is still running.
        saveDeferred = true
        return
      }

      await scheduleSave()
    },

    async suspend(): Promise<void> {
      suspended = true
      await txQueue.catch(() => undefined)
      if (dirty) await scheduleSave()
    },

    resume(): void {
      suspended = false
    },

    async close(): Promise<void> {
      // Flush anything queued before tearing the database down, or the last
      // write is dropped. A failed persist must still let us close.
      await savePromise.catch(() => undefined)
      db.close()
    },
  }
}
