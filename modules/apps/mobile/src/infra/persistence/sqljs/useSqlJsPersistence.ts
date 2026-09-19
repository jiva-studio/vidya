import initSqlJs, { type SqlJsStatic } from 'sql.js'

import type { IDatabase, IPersistence } from '@/ports'

import { createSqlJsDatabase } from './sqlJsDatabase'

/**
 * Where a closed database's bytes wait for the next `open` of the same name.
 *
 * Reopening a name and getting the previous image back is what lets a test
 * stage a process restart: run migrations, close, open again, and assert that
 * the second run changed nothing.
 */
export type ImageStore = Map<string, Uint8Array>

/** Optional wiring; the defaults are what a test wants. */
export interface SqlJsPersistenceOptions {
  /**
   * Where images live between opens. Pass one in to inspect or seed the bytes;
   * omit it and each factory gets a private store.
   */
  images?: ImageStore

  /** Where the sql.js wasm binary is. Node resolves it on its own. */
  locateFile?: (file: string) => string
}

/**
 * A {@link IPersistence} backed by `sql.js`, for tests.
 *
 * It gives real SQLite semantics — transactions, rollback, constraints,
 * `PRAGMA foreign_key_list` — with no device, no emulator and no build step.
 * The Capacitor adapter is the one that ships; this one is how what ships is
 * checked.
 *
 * Databases are held as in-memory images rather than files, so a test never
 * touches the filesystem and two tests can never see each other's rows.
 */
export function useSqlJsPersistence(options: SqlJsPersistenceOptions = {}): IPersistence {
  const images: ImageStore = options.images ?? new Map()
  let engine: Promise<SqlJsStatic> | null = null

  // Initialising sql.js compiles the wasm module, which is slow enough to be
  // worth doing once per factory rather than once per open.
  function loadEngine(): Promise<SqlJsStatic> {
    engine ??= initSqlJs(options.locateFile ? { locateFile: options.locateFile } : undefined)
    return engine
  }

  return {
    async open(dbName: string): Promise<IDatabase> {
      const SQL = await loadEngine()
      const image = images.get(dbName)
      const db = image ? new SQL.Database(image) : new SQL.Database()

      return createSqlJsDatabase(db, async (data) => {
        images.set(dbName, data)
      })
    },
  }
}
