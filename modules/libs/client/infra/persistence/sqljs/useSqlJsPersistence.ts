import initSqlJs, { type SqlJsStatic } from 'sql.js'
// The browser build's own binary, taken from the bundle. sql.js asks for its
// wasm by bare filename, which a page resolves against its own address: the
// dev server answers that with `index.html`, and sql.js's fallback is
// `sql.js.org`, which answers 404. Either way the app opens with no database
// and says so on a screen — and neither shows up in a test, because under Node
// the file sits next to the module and is found without being asked for.
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'

import type { IDatabase, IPersistence } from '../../../ports'
import {
  hasIndexedDb,
  type ImageStorage,
  type ImageStore,
  indexedDbImages,
  inMemoryImages,
} from './imageStorage'
import { createSqlJsDatabase } from './sqlJsDatabase'

export type { ImageStore } from './imageStorage'

/** Optional wiring; the defaults are what a test wants. */
export interface SqlJsPersistenceOptions {
  /**
   * Where images live between opens. Pass one in to inspect or seed the bytes
   * — and to keep a test out of the browser's storage, which the default uses
   * when there is one.
   */
  images?: ImageStore
}

/**
 * A {@link IPersistence} backed by `sql.js`: everywhere that is not a handset.
 *
 * It gives real SQLite semantics — transactions, rollback, constraints,
 * `PRAGMA foreign_key_list` — with no device, no emulator and no build step.
 * The Capacitor adapter is the one that ships; this one is how what ships is
 * checked, and it is also what the web build runs on.
 *
 * The image is held wherever the platform can keep it: in IndexedDB in a
 * browser, so a reload finds the student's courses where they left them, and
 * in memory anywhere else, so a test never touches storage and two tests can
 * never see each other's rows.
 */
export function useSqlJsPersistence(options: SqlJsPersistenceOptions = {}): IPersistence {
  const images = storageFor(options)
  let engine: Promise<SqlJsStatic> | null = null

  // Initialising sql.js compiles the wasm module, which is slow enough to be
  // worth doing once per factory rather than once per open.
  //
  // Which binary to point at depends on which of sql.js's two builds is
  // loaded, and the presence of a Node process is what decides that. Under
  // Node — the tests, whether they run in `node` or in `jsdom` — sql.js reads
  // its own file from disk and a URL meant for a page would send it looking
  // for something that is not there. In a browser it fetches, and the only
  // address that answers is the one the bundler emitted.
  function loadEngine(): Promise<SqlJsStatic> {
    const underNode = typeof process !== 'undefined'
    engine ??= initSqlJs(underNode ? undefined : { locateFile: () => sqlWasmUrl })

    return engine
  }

  return {
    async open(dbName: string): Promise<IDatabase> {
      const SQL = await loadEngine()

      // SQLite is brought up from the stored file, or empty when there is none
      // — a first launch, or a browser that has nowhere to keep one.
      const image = await images.read(dbName)
      const db = image ? new SQL.Database(image) : new SQL.Database()

      return createSqlJsDatabase(db, (data) => images.write(dbName, data))
    },
  }
}

/**
 * Storage a test asked for, the browser's own, or memory.
 *
 * A passed-in map wins, so a test says where its bytes go. Otherwise the
 * browser's storage is used when there is one: the app opens its database
 * through a fresh factory on every launch, and only a store outside the
 * process can carry an image from one launch to the next.
 */
function storageFor(options: SqlJsPersistenceOptions): ImageStorage {
  if (options.images) return inMemoryImages(options.images)
  return hasIndexedDb() ? indexedDbImages() : inMemoryImages(new Map())
}
