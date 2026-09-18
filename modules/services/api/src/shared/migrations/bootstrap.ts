import { ConfigService } from '@nestjs/config'
import { Client } from 'pg'

import { runMigrations } from './runner'

/**
 * Applies pending migrations before the application starts serving.
 *
 * Opens its own connection rather than borrowing the application pool: the
 * advisory lock the runner takes is session-scoped, and a pool would hand back
 * a different session for the release, leaving the lock held until the process
 * dies.
 */
export const bootstrapMigrations = async (config: ConfigService): Promise<void> => {
  const client = new Client({
    host: config.get<string>('db.host'),
    port: config.get<number>('db.port'),
    user: config.get<string>('db.username'),
    password: config.get<string>('db.password'),
    database: config.get<string>('db.database'),
  })

  await client.connect()
  try {
    const dir = config.get<string>('migrations.dir')
    const applied = await runMigrations(client, dir)

    if (applied.length > 0) {
      console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`)
    }
  } finally {
    await client.end()
  }
}
