import { MigrationClient, runMigrations } from '@vidya/api/shared/migrations'
import { Entities } from '@vidya/entities'
import { join } from 'path'
import { Client } from 'pg'
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
  await resetSchema(database)

  const ds = new DataSource({
    type: 'postgres',
    entities: Entities,
    ...postgresTestConfig(database),
  })

  await ds.initialize()
  await applyMigrations(ds)

  return ds
}

/**
 * Empties the worker's database before the pool is opened.
 *
 * Dropping rather than truncating means a migration that only works against a
 * database it has already run on cannot hide here.
 *
 * It runs on its own connection, and before `initialize()`, for a reason that
 * cost an afternoon: a pooled connection resolves `public` to a schema OID when
 * it is first used, so a connection opened before the drop keeps pointing at
 * the schema that no longer exists. The next statement on it fails with "no
 * schema has been selected to create in" — intermittently, depending on which
 * connection the pool hands out.
 */
const resetSchema = async (database: string): Promise<void> => {
  const client = new Client(pgClientConfig(database))
  await client.connect()

  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE')
    await client.query('CREATE SCHEMA public')
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
  } finally {
    await client.end()
  }
}

/** Creates the worker's database on first use; a second call is a no-op. */
const ensureDatabase = async (database: string): Promise<void> => {
  const admin = new Client(pgClientConfig('postgres'))
  await admin.connect()

  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])

    if (rows.length === 0) {
      // Not parameterisable: CREATE DATABASE takes an identifier, not a value.
      // The name is built from a worker id we generated, never from input.
      await admin.query(`CREATE DATABASE "${database}"`)
    }
  } catch (error) {
    // Two workers can reach this at the same moment on a cold database; the
    // loser sees a duplicate and can carry on, because the database it wanted
    // now exists.
    if (!/already exists/.test((error as Error).message)) throw error
  } finally {
    await admin.end()
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
