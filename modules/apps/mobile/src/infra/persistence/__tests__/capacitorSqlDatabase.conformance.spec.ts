import { describe, expect, it, vi } from 'vitest'

import { createCapacitorSqlDatabase } from '../capacitor/capacitorSqlDatabase'
import { openSqlJsDatabase, wrapAsCapacitorConnection } from './capacitorConnectionDouble'
import { describeDatabaseConformance } from './databaseConformance'

/**
 * The port's promises, checked against the adapter that ships.
 *
 * Before this the Capacitor adapter had never run anywhere: not in the app,
 * which opens it only on a device, and not in a test, which opens sql.js. The
 * connection under it is a stand-in (see `capacitorConnectionDouble`), so this
 * proves the adapter's own logic and not the plugin's — but the adapter's own
 * logic is where every finding was.
 */
describeDatabaseConformance({
  name: 'capacitor (stand-in connection)',
  async create() {
    const sqlite = await openSqlJsDatabase()
    const { connection } = wrapAsCapacitorConnection(sqlite)

    // A reopen hands back the same database, which is what a file does. The
    // release is a no-op here for the same reason: nothing is torn down.
    return { open: async () => createCapacitorSqlDatabase(connection, async () => undefined) }
  },
})

describe('the capacitor adapter, where sql.js cannot follow', () => {
  const opened = async () => {
    const sqlite = await openSqlJsDatabase()
    const double = wrapAsCapacitorConnection(sqlite)
    const release = vi.fn(async () => undefined)
    const db = createCapacitorSqlDatabase(double.connection, release)

    await db.execute('CREATE TABLE notes (id TEXT PRIMARY KEY)')
    return { db, double, release }
  }

  const insert = (id: string) => `INSERT INTO notes (id) VALUES ('${id}')`

  it('R2: recovers from a rollback the connection could not perform', async () => {
    const { db, double } = await opened()

    // On a device a rollback can fail, and the transaction stays open. Without
    // recovery every later block dies on BEGIN — for the rest of the session,
    // because nothing here restarts the app.
    double.faults.failRollback = true

    await expect(
      db.transaction(async () => {
        await db.execute(insert('undone'))
        throw new Error('the block failed')
      }),
    ).rejects.toThrow('the block failed')

    expect(double.isActive()).toBe(true)

    double.faults.failRollback = false
    await db.transaction(async () => db.execute(insert('after')))

    const rows = await db.query<{ id: string }>('SELECT id FROM notes')
    expect(rows.map((row) => row.id)).toEqual(['after'])
  })

  it('R2: reports a stale transaction it cannot clear, rather than a puzzling BEGIN', async () => {
    const { db, double } = await opened()

    double.faults.failRollback = true

    await expect(
      db.transaction(async () => {
        throw new Error('the block failed')
      }),
    ).rejects.toThrow('the block failed')

    // Still broken on the next attempt: the caller is told what is wrong with
    // the connection, not that a transaction cannot start inside a transaction.
    await expect(db.transaction(async () => undefined)).rejects.toThrow(/rollback failed/)
  })

  it('R1: closes the connection once, through the plugin registry', async () => {
    const { db, release } = await opened()

    // `closeConnection` closes the database and then drops it from the
    // registry, so closing it here first asked the plugin to close a database
    // it was about to close again.
    await db.close()

    expect(release).toHaveBeenCalledTimes(1)
  })
})
