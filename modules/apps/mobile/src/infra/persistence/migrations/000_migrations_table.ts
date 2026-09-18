import type { Migration } from './types'

/**
 * Bootstraps the `migrations` table itself.
 *
 * Applied unconditionally by the runner before any other migration, because
 * the applied set cannot be read until the table it lives in exists.
 */
export const migration_000_migrations_table: Migration = {
  name: '000_migrations_table',
  up: async (db) => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        name       TEXT NOT NULL PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `)
  },
}
