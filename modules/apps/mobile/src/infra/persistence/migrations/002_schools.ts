import type { Migration } from './types'

/**
 * The school itself, so a card can name the school it belongs to offline.
 *
 * A migration of its own rather than an edit to `001_local_schema`: handsets in
 * the field have already recorded that name as applied and will never run it
 * again, whatever it says afterwards.
 *
 * `school_id` restates `id` — a school row is its own school, and the envelope
 * carries the field for every collection alike. It sits here like it does on
 * every other synced table, so the layout has one shape and not two.
 */
export const migration_002_schools: Migration = {
  name: '002_schools',
  up: async (db) => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS schools (
        id          TEXT NOT NULL,
        owner_id    TEXT NOT NULL,
        school_id   TEXT NOT NULL,
        name        TEXT NOT NULL,
        logo_url    TEXT,
        description TEXT,
        PRIMARY KEY (owner_id, id)
      )
    `)
  },
}
