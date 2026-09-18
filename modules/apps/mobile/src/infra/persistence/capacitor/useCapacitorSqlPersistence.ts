import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'

import type { IDatabase, IPersistence } from '@/ports'

import { createCapacitorSqlDatabase } from './capacitorSqlDatabase'

/** Statements a contended write should wait on rather than fail, in ms. */
const BUSY_TIMEOUT_MS = 3000

/**
 * The device's persistence: `@capacitor-community/sqlite`.
 *
 * Logic follows `apps/mobile/infra/persistence/capacitor/useCapacitorSqlPersistence.ts`
 * in lectorium, minus its two complications. There is no non-conformed path
 * handling, because this app has exactly one database and no bundled catalogs
 * to open from the filesystem; and `PRAGMA foreign_keys` is not set, because
 * the schema has no foreign keys to enforce (D-13).
 */
export function useCapacitorSqlPersistence(): IPersistence {
  const sqlite = new SQLiteConnection(CapacitorSQLite)

  /**
   * Reconciles the JS and native halves of the plugin's connection registry,
   * once.
   *
   * A webview reload wipes the JS-side registry while the native side survives
   * — the process was never restarted — and the next `createConnection` for
   * the same name then fails with "Connection already exists". The plugin's
   * own consistency check closes native entries the JS side no longer knows
   * about, which with an empty registry means all of them.
   */
  let consistency: Promise<void> | null = null
  function ensureConsistent(): Promise<void> {
    consistency ??= sqlite.checkConnectionsConsistency().then(
      () => undefined,
      () => undefined,
    )
    return consistency
  }

  /**
   * Second layer for the same problem: close a connection the JS registry
   * still remembers for this name before creating a new one.
   */
  async function releaseStale(dbName: string): Promise<void> {
    try {
      const { result } = await sqlite.isConnection(dbName, false)
      if (result === true) await sqlite.closeConnection(dbName, false)
    } catch {
      // Best effort. If the plugin cannot tell us or cannot close a stale
      // connection, let `createConnection` below surface the real error.
    }
  }

  return {
    async open(dbName: string): Promise<IDatabase> {
      await ensureConsistent()
      await releaseStale(dbName)

      const db = await sqlite.createConnection(dbName, false, 'no-encryption', 1, false)
      await db.open()

      // Outside any transaction, hence `false`. Without it a write that
      // overlaps another one fails with "database is locked" instead of
      // waiting the moment out.
      await db.run(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`, [], false)

      return createCapacitorSqlDatabase(db, () => sqlite.closeConnection(dbName, false))
    },
  }
}
