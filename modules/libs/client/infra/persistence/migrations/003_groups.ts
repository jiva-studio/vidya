import type { Migration } from './types'

/**
 * The groups of a course, as the catalogue a student reads before enrolling.
 *
 * `school_id` rather than the course alone: a student who holds no place holds
 * no course scope either, so the rows ride the school scope and are filtered by
 * course here.
 *
 * `groups` is a reserved word in SQLite and is quoted wherever it is named.
 */
export const migration_003_groups: Migration = {
  name: '003_groups',
  up: async (db) => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "groups" (
        id          TEXT NOT NULL,
        owner_id    TEXT NOT NULL,
        school_id   TEXT NOT NULL,
        course_id   TEXT NOT NULL,
        name        TEXT NOT NULL,
        description TEXT,
        starts_at   TEXT,
        status      TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      )
    `)

    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_groups_course ON "groups" (owner_id, course_id)',
    )
  },
}
