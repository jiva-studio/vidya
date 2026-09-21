import { parseIsoDateTime } from '@vidya/domain'

import type { IDatabase, IPersistence } from '../../ports'
import { deviceMigrations, type Migration, runMigrations, type UtcClock } from './migrations'
import { type ImageStore, useSqlJsPersistence } from './sqljs'

/**
 * Opening a migrated local database in one line, for tests.
 *
 * Deliberately not exported from this package's barrel: it belongs to tests,
 * and nothing in the app should be able to reach it by accident.
 *
 * Running the engine against real SQLite with no device and no emulator is how
 * the device code gets checked, so the ceremony of doing it is kept to nothing.
 */

/** A frozen instant, so a recorded `applied_at` is something a test can assert. */
export const TEST_NOW = parseIsoDateTime('2026-09-18T00:00:00.000Z')

/** A clock pinned to {@link TEST_NOW}. */
export const fixedClock: UtcClock = () => TEST_NOW

export interface TestDatabaseOptions {
  /** Which migrations to run. Defaults to the real set. */
  migrations?: readonly Migration[]

  /** Shared images, so a test can close a database and open it again. */
  images?: ImageStore

  /** The name to open. Only matters alongside `images`. */
  dbName?: string

  /** Defaults to {@link fixedClock}. */
  now?: UtcClock
}

export interface TestDatabase {
  db: IDatabase
  images: ImageStore
  dbName: string
  persistence: IPersistence
}

/**
 * Opens a sql.js database and migrates it.
 *
 * Reopening with the same `images` and `dbName` gives back the same bytes,
 * which is how a test stages a relaunch: migrate, close, open again, and check
 * that the second run had nothing left to do.
 */
export async function openTestDatabase(options: TestDatabaseOptions = {}): Promise<TestDatabase> {
  const images = options.images ?? new Map()
  const dbName = options.dbName ?? 'vidya-test'
  const persistence = useSqlJsPersistence({ images })

  const db = await persistence.open(dbName)
  await runMigrations(db, options.migrations ?? deviceMigrations, options.now ?? fixedClock)

  return { db, images, dbName, persistence }
}

/** The tables the schema declares, ignoring SQLite's own bookkeeping. */
export async function listTables(db: IDatabase): Promise<string[]> {
  const rows = await db.query<{ name: string }>(
    `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name`,
  )

  return rows.map((row) => row.name)
}
