import { Entities } from '@vidya/entities'
import { Clock, registerSyncJournalSubscriber } from '@vidya/journal'
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

/** The seeder's reading of the wall clock, the one thing the journal asks of it. */
const seedClock: Clock = { nowMs: () => Date.now() }

/**
 * Registers the journal writer on an open connection.
 *
 * Seeded rows are ordinary synchronised writes and have to enter `sync_journal`
 * like any other, or a device pulls an empty answer from a database that is
 * visibly full.
 */
export const attachSyncJournal = (connection: DataSource): DataSource => {
  registerSyncJournalSubscriber(connection, seedClock)

  return connection
}

/** The seeder's connection, open and journalling. */
export const openSeedConnection = async (): Promise<DataSource> =>
  attachSyncJournal(await SeedDataSource.initialize())
