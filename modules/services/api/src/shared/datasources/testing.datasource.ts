import { MigrationClient, runMigrations } from '@vidya/api/shared/migrations'
import { Entities } from '@vidya/entities'
import { join } from 'path'
import { DataType, newDb } from 'pg-mem'
import { DataSource } from 'typeorm'
import { v4 } from 'uuid'

/** The same `.sql` files production applies, so the test schema cannot drift. */
export const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'migrations')

/**
 * Which database the suite runs against.
 *
 * `memory` is the default because it keeps the inner loop fast and needs no
 * services running. It is not Postgres, though: its planner, its locking and
 * parts of its SQL dialect differ, and this project has already been bitten
 * once by a migration that parsed everywhere except here. `postgres` exists so
 * the things a fake cannot model — advisory locks, real unique indexes under
 * concurrency, ON DELETE behaviour — are checked against the real thing.
 */
export type TestDatabase = 'memory' | 'postgres'

export const testDatabase = (): TestDatabase =>
  process.env.VIDYA_TEST_DB === 'postgres' ? 'postgres' : 'memory'

const BASE_DATABASE = process.env.VIDYA_TEST_DB_DATABASE || 'vidya_test'

const connection = (database: string) => ({
  host: process.env.VIDYA_TEST_DB_HOST || '127.0.0.1',
  port: Number(process.env.VIDYA_TEST_DB_PORT || 5432),
  user: process.env.VIDYA_TEST_DB_USERNAME || 'postgres',
  password: process.env.VIDYA_TEST_DB_PASSWORD || 'postgres',
  database,
})

/**
 * For `pg.Client`, which names the role `user`.
 *
 * TypeORM calls the same field `username`, and passing one shape where the
 * other is expected does not fail — the driver quietly falls back to the OS
 * user and the error arrives later as "role does not exist".
 */
export const pgClientConfig = (database: string = BASE_DATABASE) => connection(database)

/** For TypeORM, which names the role `username`. */
export const postgresTestConfig = (database: string = BASE_DATABASE) => {
  const { user, ...rest } = connection(database)
  return { ...rest, username: user }
}

/**
 * One database per Jest worker.
 *
 * Suites run in parallel and each starts by recreating its schema, so sharing a
 * database would have one worker dropping the tables another is mid-query on.
 * The worker id is stable for the life of the process, which is what makes this
 * safe rather than merely lucky.
 */
const workerDatabase = (): string => {
  const worker = process.env.JEST_WORKER_ID
  return worker ? `${BASE_DATABASE}_${worker}` : BASE_DATABASE
}

/* -------------------------------------------------------------------------- */
/*                                   Memory                                   */
/* -------------------------------------------------------------------------- */

const inMemoryDataSource = async (): Promise<DataSource> => {
  const db = newDb()

  db.public.registerFunction({ implementation: () => 'test', name: 'current_database' })

  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 16.1 on x86_64-pc-linux-gnu, 64-bit',
    impure: true,
  })

  // pg-mem is single-session by construction, so there is nothing for an
  // advisory lock to serialise. The calls still have to resolve, or the runner
  // fails before it reaches the first migration — which is exactly why the
  // lock's real behaviour is only provable under `VIDYA_TEST_DB=postgres`.
  for (const name of ['pg_advisory_lock', 'pg_advisory_unlock']) {
    db.public.registerFunction({
      name,
      args: [DataType.integer],
      returns: DataType.bool,
      implementation: () => true,
      impure: true,
    })
  }

  db.registerExtension('uuid-ossp', (schema) => {
    schema.registerFunction({
      name: 'uuid_generate_v4',
      returns: DataType.uuid,
      implementation: v4,
      impure: true,
    })
  })

  const ds: DataSource = await db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: Entities,
  })

  await ds.initialize()
  await applyMigrations(ds)

  return ds
}

/* -------------------------------------------------------------------------- */
/*                                  Postgres                                  */
/* -------------------------------------------------------------------------- */

const postgresDataSource = async (): Promise<DataSource> => {
  const database = workerDatabase()
  await ensureDatabase(database)

  const ds = new DataSource({
    type: 'postgres',
    entities: Entities,
    ...postgresTestConfig(database),
  })

  await ds.initialize()

  // Every suite starts from an empty schema. Dropping rather than truncating
  // means a migration that only works against a database it has already run on
  // cannot hide here.
  await ds.query('DROP SCHEMA IF EXISTS public CASCADE')
  await ds.query('CREATE SCHEMA public')
  await ds.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

  await applyMigrations(ds)

  return ds
}

/** Creates the worker's database on first use; a second call is a no-op. */
const ensureDatabase = async (database: string): Promise<void> => {
  const admin = new DataSource({ type: 'postgres', ...postgresTestConfig('postgres') })
  await admin.initialize()

  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])

    if (existing.length === 0) {
      // Not parameterisable: CREATE DATABASE takes an identifier, not a value.
      // The name is built from a worker id we generated, never from input.
      await admin.query(`CREATE DATABASE "${database}"`)
    }
  } finally {
    await admin.destroy()
  }
}

const applyMigrations = async (ds: DataSource): Promise<void> => {
  const client: MigrationClient = {
    query: async <T>(sql: string, params?: unknown[]) => ({
      rows: (await ds.query(sql, params as unknown[])) as T[],
    }),
  }

  await runMigrations(client, MIGRATIONS_DIR)
}

/* -------------------------------------------------------------------------- */
/*                                   Factory                                  */
/* -------------------------------------------------------------------------- */

export const testingDataSource = async (): Promise<DataSource> =>
  testDatabase() === 'postgres' ? postgresDataSource() : inMemoryDataSource()
