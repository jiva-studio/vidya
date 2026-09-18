import { Entities } from '@vidya/entities'
import { DataSource } from 'typeorm'

/**
 * The seeder's own connection.
 *
 * It does not run migrations — the API owns the schema and applies it at
 * startup. This only fills an already-migrated database with development data,
 * which is why it reads the same environment variables the API does instead of
 * carrying its own copy of the connection details.
 */
export const SeedDataSource = new DataSource({
  type: 'postgres',
  host: process.env.VIDYA_DB_HOST || 'localhost',
  port: Number(process.env.VIDYA_DB_PORT || 5432),
  username: process.env.VIDYA_DB_USERNAME || 'postgres',
  password: process.env.VIDYA_DB_PASSWORD || 'postgres',
  database: process.env.VIDYA_DB_DATABASE || 'postgres',
  entities: Entities,
})
