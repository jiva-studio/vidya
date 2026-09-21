import type { Migration } from './types'

/**
 * The school's public code, so a screen can turn `/s/<code>` back into a school.
 *
 * Null for a school that has never asked for a link, and for every row that
 * arrived before this column existed — the next pull fills those in.
 */
export const migration_008_school_code: Migration = {
  name: '008_school_code',
  up: async (db) => {
    await db.execute('ALTER TABLE schools ADD COLUMN code TEXT')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_schools_code ON schools (owner_id, code)')
  },
}
