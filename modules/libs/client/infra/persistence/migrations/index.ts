import { migration_000_migrations_table } from './000_migrations_table'
import { migration_001_local_schema } from './001_local_schema'
import { migration_002_schools } from './002_schools'
import { migration_003_groups } from './003_groups'
import { migration_004_enrollment_request_details } from './004_enrollment_request_details'
import { migration_005_row_scope } from './005_row_scope'
import { migration_006_course_publication } from './006_course_publication'
import { migration_007_answer_verdict } from './007_answer_verdict'
import { migration_008_school_code } from './008_school_code'
import type { Migration } from './types'

/**
 * Every device migration, in the order they are applied.
 *
 * Append only. An existing entry's `name` and `up` are frozen the moment a
 * build carrying them ships, because devices in the field have already
 * recorded that name as done and will never run it again.
 */
export const deviceMigrations: readonly Migration[] = [
  migration_000_migrations_table,
  migration_001_local_schema,
  migration_002_schools,
  migration_003_groups,
  migration_004_enrollment_request_details,
  migration_005_row_scope,
  migration_006_course_publication,
  migration_007_answer_verdict,
  migration_008_school_code,
]

export { migration_000_migrations_table } from './000_migrations_table'
export { migration_001_local_schema } from './001_local_schema'
export { migration_002_schools } from './002_schools'
export { migration_003_groups } from './003_groups'
export { migration_004_enrollment_request_details } from './004_enrollment_request_details'
export { migration_005_row_scope } from './005_row_scope'
export { migration_006_course_publication } from './006_course_publication'
export { migration_007_answer_verdict } from './007_answer_verdict'
export { migration_008_school_code } from './008_school_code'
export { EmptyMigrationSetError, runMigrations, SchemaAheadOfCodeError } from './runMigrations'
export type { Migration, UtcClock } from './types'
