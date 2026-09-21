import type { IDatabase } from '../../../ports'
import type { Migration, UtcClock } from './types'

/**
 * The migration set was empty.
 *
 * An empty set is a packaging failure, not a database that happens to need
 * nothing: it means the migrations never reached the bundle. Reporting success
 * would leave the app to fail on its first query instead, far from the cause.
 */
export class EmptyMigrationSetError extends Error {
  constructor() {
    super('no device migrations were declared')
    this.name = 'EmptyMigrationSetError'
  }
}

/**
 * The database has been migrated by a newer build than the one running.
 *
 * Migrations only go forward, so there is no way back down to a schema this
 * code understands. Failing loudly beats reading a newer schema through older
 * assumptions, which corrupts quietly and is found much later.
 */
export class SchemaAheadOfCodeError extends Error {
  constructor(readonly unknownMigrations: string[]) {
    super(`the database was migrated by a newer build: ${unknownMigrations.join(', ')}`)
    this.name = 'SchemaAheadOfCodeError'
  }
}

/**
 * Applies pending migrations in order, recording each in the `migrations`
 * table.
 *
 * An empty set is an error rather than a no-op, and a database carrying
 * migrations this build does not know about is refused.
 *
 * Safe to call on every launch — already-applied migrations are skipped by
 * name, so the second run does nothing.
 *
 * Each migration and the row that records it go in **one** transaction. On the
 * device every statement otherwise autocommits, so a failure in the middle
 * would leave half a schema behind, durable and unrecorded, and the next
 * launch would replay a migration that is no longer starting from scratch.
 *
 * The first migration must be the one that creates the `migrations` table: it
 * runs before the applied set can be read.
 */
export async function runMigrations(
  db: IDatabase,
  migrations: readonly Migration[],
  now: UtcClock,
): Promise<void> {
  if (migrations.length === 0) throw new EmptyMigrationSetError()

  // Bootstrap. `CREATE TABLE IF NOT EXISTS` makes this safe to repeat, and the
  // loop below records it like any other migration.
  await db.transaction(() => migrations[0]!.up(db))

  const applied = await db.query<{ name: string }>('SELECT name FROM migrations')
  const appliedNames = new Set(applied.map((row) => row.name))
  const declaredNames = new Set(migrations.map((migration) => migration.name))

  const unknown = [...appliedNames].filter((name) => !declaredNames.has(name))
  if (unknown.length > 0) throw new SchemaAheadOfCodeError(unknown)

  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) continue

    await db.transaction(async () => {
      await migration.up(db)
      await db.execute('INSERT INTO migrations (name, applied_at) VALUES (?, ?)', [
        migration.name,
        now(),
      ])
    })
  }

  await db.save()
}
