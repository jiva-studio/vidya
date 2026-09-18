import { Capacitor } from '@capacitor/core'
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'

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

  /**
   * A contended write waits instead of failing. Best effort, deliberately.
   *
   * The statement goes through the plugin, which parses what it is given, and
   * a plugin version that refuses this one would otherwise take `open` down
   * with it — and with `open` the whole launch, over a setting that only
   * decides whether a rare collision waits three seconds or reports "database
   * is locked". A timeout is an optimisation; starting is not.
   */
  async function setBusyTimeout(db: SQLiteDBConnection): Promise<void> {
    try {
      // Outside any transaction, and not as SQL92: a PRAGMA is not a statement
      // that dialect describes.
      await db.run(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`, [], false, 'no', false)
    } catch (error) {
      // Not rethrown, and not silent either: the app runs without the timeout,
      // and the reason is on the console for whoever reads it next.
      console.warn('sqlite: busy_timeout could not be set; continuing without it', error)
    }
  }

  return {
    async open(dbName: string): Promise<IDatabase> {
      requireNativePlatform()

      await ensureConsistent()
      await releaseStale(dbName)

      const db = await sqlite.createConnection(dbName, false, 'no-encryption', 1, false)
      await db.open()
      await setBusyTimeout(db)

      return createCapacitorSqlDatabase(db, () => sqlite.closeConnection(dbName, false))
    },
  }
}

/**
 * Refuse to open anywhere but on a device.
 *
 * On a native platform the plugin writes to a real file and COMMIT is
 * durability, which is why {@link createCapacitorSqlDatabase}'s `save` is
 * empty. On the web the same plugin keeps the database in memory until
 * `initWebStore` and `saveToStore` are wired up, and this app wires up
 * neither — so a database opened there would work perfectly, answer every
 * query, and vanish on reload without a single error. The student would be
 * told nothing and would lose everything written offline.
 *
 * Refusing is the honest half of that choice. The web lane of this app runs on
 * `useSqlJsPersistence`, which exports its image and is durable by design; if
 * the Capacitor adapter is ever wanted on the web, the web store is what has
 * to be implemented, not this guard that has to be removed.
 */
function requireNativePlatform(): void {
  const platform = Capacitor.getPlatform()
  if (platform === 'ios' || platform === 'android') return

  throw new Error(
    `the Capacitor SQLite adapter needs a native platform, not "${platform}": ` +
      'its database would live in memory and be lost on reload without an error',
  )
}
