import type { Migration } from './types'

/**
 * A course now says whether its school is showing it.
 *
 * Every status is journalled, drafts included, so the column arrives filled
 * and the catalogue screen is what hides a draft. Existing rows default to
 * `published`: they were sent before the field existed, which only happened
 * to courses their schools were already showing.
 */
export const migration_006_course_publication: Migration = {
  name: '006_course_publication',
  up: async (db) => {
    await db.execute(`ALTER TABLE courses ADD COLUMN status TEXT NOT NULL DEFAULT 'published'`)
  },
}
