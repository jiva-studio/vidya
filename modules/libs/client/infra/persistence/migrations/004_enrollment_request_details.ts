import type { Migration } from './types'

/**
 * What the student asked for, beside what the school answered.
 *
 * `archived_by_student_at` is the student's own stamp and the only half of the
 * archiving that travels; the school's two columns are not here because they
 * never reach the wire, and a column nothing fills could only mislead.
 */
export const migration_004_enrollment_request_details: Migration = {
  name: '004_enrollment_request_details',
  up: async (db) => {
    const statements = [
      'ALTER TABLE enrollments ADD COLUMN preferred_group_id TEXT',
      'ALTER TABLE enrollments ADD COLUMN preferred_times TEXT',
      'ALTER TABLE enrollments ADD COLUMN comment TEXT',
      'ALTER TABLE enrollments ADD COLUMN archived_by_student_at TEXT',
    ]

    for (const statement of statements) await db.execute(statement)
  },
}
