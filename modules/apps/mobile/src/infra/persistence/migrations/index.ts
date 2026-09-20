import { migration_000_migrations_table } from './000_migrations_table'
import { migration_001_local_schema } from './001_local_schema'
import { migration_002_schools } from './002_schools'
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
]

export { migration_000_migrations_table } from './000_migrations_table'
export { migration_001_local_schema } from './001_local_schema'
export { migration_002_schools } from './002_schools'
export { EmptyMigrationSetError, runMigrations, SchemaAheadOfCodeError } from './runMigrations'
export type { Migration, UtcClock } from './types'
