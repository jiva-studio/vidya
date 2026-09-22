import { deviceMigrations, type IDatabase, runMigrations, useSqlJsPersistence } from '@vidya/client'
import { toIsoDateTime } from '@vidya/domain'

/**
 * The local database of this browser: SQLite compiled to WebAssembly, with its
 * image kept in IndexedDB.
 *
 * There is no disk in a tab. `sql.js` holds the database in memory and the
 * image has to be put where it outlives the page, or a reload starts the
 * student from nothing with their unsent work in it. Until an OPFS adapter
 * replaces this one, that image is written whole on every committed write,
 * which is also why only one tab may write it.
 */
const DB_NAME = 'vidya'

export const openSite = (): Promise<IDatabase> => useSqlJsPersistence().open(DB_NAME)

/**
 * Brings the schema up to date. Only the writing tab may call it.
 *
 * A migration writes, and a write is exported to IndexedDB whole — so a second
 * tab migrating its own copy would publish that copy over the one the writer
 * is working in. The schema comes before the first screen for the same reason
 * it does on the handset: a list drawn against a half-created database is not
 * empty for a moment, it is empty and wrong, and a student cannot tell that
 * apart from having no courses.
 */
export const migrateSite = (db: IDatabase): Promise<void> =>
  runMigrations(db, deviceMigrations, () => toIsoDateTime(new Date()))
