import { MigrationClient, runMigrations } from '@vidya/api/shared/migrations'
import { Entities } from '@vidya/entities'
import { createHash, randomUUID } from 'crypto'
import { basename, join, resolve } from 'path'
import { Client } from 'pg'
import { DataType, newDb } from 'pg-mem'
import { DataSource } from 'typeorm'

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

/** Repository root: six levels up from `services/api/src/shared/datasources`. */
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '..')

/**
 * A database name unique to the checkout the tests are running from.
 *
 * Several worktrees of this repository share one Postgres server, and each
 * suite starts by dropping and recreating `public`. A name shared between
 * checkouts therefore has one run deleting the schema another is mid-query on,
 * which surfaces as unrelated-looking failures — a missing column, "no schema
 * has been selected", a deadlock — that disappear when the suite is run alone.
 *
 * The name is derived, not random, so the same checkout reuses its database
 * instead of leaving a new one behind on every run. The readable part is for
 * whoever lists the databases later; the hash is what actually makes it unique,
 * since directory names can collide once stripped to identifier characters.
 */
const checkoutDatabase = (): string => {
  const slug = basename(REPO_ROOT)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16)
  const digest = createHash('sha1').update(REPO_ROOT).digest('hex').slice(0, 8)

  return slug ? `vidya_test_${slug}_${digest}` : `vidya_test_${digest}`
}

const BASE_DATABASE = process.env.VIDYA_TEST_DB_DATABASE || checkoutDatabase()

/**
 * Names a database beside the checkout's own, for a suite that needs one of its
 * own. Going through here rather than composing a literal keeps the suite
 * inside this checkout's namespace, and inside `make db-testdb-drop`'s reach.
 */
export const testDatabaseName = (scope: string): string => `${BASE_DATABASE}_${scope}`

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
 * One database per Jest worker, within this checkout's namespace.
 *
 * Suites run in parallel and each starts by recreating its schema, so sharing a
 * database would have one worker dropping the tables another is mid-query on.
 * The worker id is stable for the life of the process, which is what makes this
 * safe rather than merely lucky.
 */
const workerDatabase = (): string => {
  const worker = process.env.JEST_WORKER_ID
  return worker ? testDatabaseName(worker) : BASE_DATABASE
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

  // pg-mem is single-session, so these only need to resolve; the locks are proved under postgres.
  // `pg_advisory_xact_lock` is the journal's ordering lock and is exercised by every
  // write that reaches sync_journal, so the memory suite needs it to resolve as well.
  for (const name of [
    'pg_advisory_lock',
    'pg_try_advisory_lock',
    'pg_advisory_unlock',
    'pg_advisory_xact_lock',
  ]) {
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
      implementation: randomUUID,
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
      // CREATE DATABASE takes an identifier, not a value; the name is our own worker id.
      await admin.query(`CREATE DATABASE "${database}"`)
    }
  } catch (error) {
    // Two workers can race here on a cold database; the loser carries on, the database exists.
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
