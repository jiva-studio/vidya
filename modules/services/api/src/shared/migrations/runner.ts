import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

/**
 * The slice of a Postgres client the runner needs.
 *
 * Declared here rather than imported from `pg` so the runner can be driven by
 * whatever the caller has a session on. This matters for the advisory lock:
 * it is session-scoped, so the caller must hand over a single dedicated
 * connection, never a pool that hands out a different session per query.
 */
export interface MigrationClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

/**
 * Identifies the migration lock. Any constant works as long as every deployment
 * of this service uses the same one; a second process then waits here instead
 * of racing the first through the same DDL.
 */
const LOCK_ID = 4_182_003

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name        TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`

/** Reads the migration file names, failing loudly rather than finding nothing. */
const readMigrationNames = (dir: string): string[] => {
  let entries: string[]
  try {
    if (!statSync(dir).isDirectory()) {
      throw new Error(`migrations path is not a directory: ${dir}`)
    }
    entries = readdirSync(dir)
  } catch (error) {
    throw new Error(`cannot read migrations directory ${dir}: ${(error as Error).message}`)
  }

  const names = entries.filter((name) => name.endsWith('.sql')).sort()

  // An empty directory almost always means the .sql files never made it into
  // the image. Reporting success here would start the service against an
  // unmigrated database, and the first query would be the one to fail.
  if (names.length === 0) {
    throw new Error(`no migrations found in ${dir}`)
  }

  return names
}

/**
 * Applies every migration that has not been applied yet, in lexical order.
 *
 * Each file runs in its own transaction, so a failure leaves the database at
 * the last complete migration rather than halfway through one. Migrations are
 * forward-only: there is no `down`, because rolling the service image back does
 * not roll the schema back, and a mistake is corrected by the next migration.
 *
 * @returns the names applied by this call, in order.
 */
export const runMigrations = async (client: MigrationClient, dir: string): Promise<string[]> => {
  const names = readMigrationNames(dir)

  await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID])
  try {
    await client.query(CREATE_TABLE)

    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations')
    const applied = new Set(rows.map((row) => row.name))

    const pending = names.filter((name) => !applied.has(name))
    for (const name of pending) {
      const sql = readFileSync(join(dir, name), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`migration ${name} failed: ${(error as Error).message}`)
      }
    }

    return pending
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID])
  }
}
