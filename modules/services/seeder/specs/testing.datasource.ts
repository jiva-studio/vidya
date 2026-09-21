import { Entities } from '@vidya/entities'
import { randomUUID } from 'crypto'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { DataType, newDb } from 'pg-mem'
import { DataSource } from 'typeorm'

/**
 * The same `.sql` files the API applies at startup.
 *
 * Synchronising from the entities instead would build a schema nothing else
 * ever runs against — and it does not even work here: `userRoles` is both an
 * entity and a join table, and TypeORM reconciles the two with an `ALTER TABLE
 * ... DROP CONSTRAINT` that pg-mem has no answer for.
 */
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'api', 'migrations')

const applyMigrations = async (dataSource: DataSource): Promise<void> => {
  const names = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  if (names.length === 0) throw new Error(`no migrations found in ${MIGRATIONS_DIR}`)

  for (const name of names) {
    await dataSource.query(readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
  }
}

/** An empty, migrated database in memory. */
export const testingDataSource = async (): Promise<DataSource> => {
  const db = newDb()

  db.public.registerFunction({ name: 'current_database', implementation: () => 'test' })
  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 16.1 on x86_64-pc-linux-gnu, 64-bit',
    impure: true,
  })
  // The journal takes an ordering lock before every insert, so a datasource
  // that seeds through the journal needs the function to resolve.
  for (const name of ['pg_advisory_lock', 'pg_advisory_unlock', 'pg_advisory_xact_lock']) {
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

  const dataSource: DataSource = await db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: Entities,
  })

  await dataSource.initialize()
  await applyMigrations(dataSource)

  return dataSource
}
