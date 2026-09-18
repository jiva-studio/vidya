import { MigrationClient, runMigrations } from '@vidya/api/shared/migrations'
import { Entities } from '@vidya/entities'
import { join } from 'path'
import { DataType, newDb } from 'pg-mem'
import { DataSource } from 'typeorm'
import { v4 } from 'uuid'

/** The same `.sql` files production applies, so tests cannot drift from the schema. */
export const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'migrations')

export const inMemoryDataSource = async () => {
  const db = newDb()

  db.public.registerFunction({
    implementation: () => 'test',
    name: 'current_database',
  })

  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () =>
      'PostgreSQL 16.1 (Debian 16.1-1.pgdg120+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14) 12.2.0, 64-bit',
    impure: true,
  })

  // The runner takes a session advisory lock. pg-mem is single-session by
  // construction, so there is nothing to serialise — but the calls still have to
  // resolve, otherwise the runner fails before reaching the first migration.
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

  const client: MigrationClient = {
    query: async <T>(sql: string, params?: unknown[]) => ({
      rows: (await ds.query(sql, params as unknown[])) as T[],
    }),
  }
  await runMigrations(client, MIGRATIONS_DIR)

  return ds
}
