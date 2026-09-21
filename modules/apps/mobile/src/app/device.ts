import { Capacitor } from '@capacitor/core'
import { deviceMigrations, type IDatabase, runMigrations, useSqlJsPersistence } from '@vidya/client'
import { toIsoDateTime } from '@vidya/domain'

import { useCapacitorSqlPersistence } from '@/infra/persistence/capacitor'

/**
 * The device's database: opened once, migrated before anything reads it.
 *
 * Every screen now reads from here, so the schema has to exist before the first
 * one is mounted. A list rendered against a schema that is still being created
 * is not empty for a moment — it is empty and wrong, and a student cannot tell
 * that apart from "you are not enrolled in anything".
 */

const DB_NAME = 'vidya'

let device: IDatabase | null = null

/**
 * Capacitor on a handset, sql.js anywhere else.
 *
 * The Capacitor adapter refuses to open off a native platform, because there
 * its database lives in memory and disappears on reload without an error. The
 * web build is a development convenience and gets the adapter that says so.
 */
const persistence = () =>
  Capacitor.isNativePlatform() ? useCapacitorSqlPersistence() : useSqlJsPersistence()

export async function openDevice(): Promise<IDatabase> {
  const db = await persistence().open(DB_NAME)
  await runMigrations(db, deviceMigrations, () => toIsoDateTime(new Date()))
  device = db

  return db
}

/** The open database. Throws before {@link openDevice} has finished. */
export function useDevice(): IDatabase {
  if (device === null) throw new Error('the device database has not been opened yet')
  return device
}
