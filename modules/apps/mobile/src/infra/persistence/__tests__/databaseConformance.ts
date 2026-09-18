import { describe, expect, it } from 'vitest'

import { DatabaseSuspendedError, type IDatabase } from '@/ports'

/**
 * One suite, run against every implementation of {@link IDatabase}.
 *
 * The port has two adapters and only one of them was ever tested. That is the
 * cause behind every finding in the Capacitor adapter, not a coincidence beside
 * them: a promise the port makes and only one adapter keeps is a promise the
 * app relies on and the device breaks. So the promises are written once, here,
 * and parameterised by the thing that has to keep them.
 *
 * On CI this runs against sql.js and against the Capacitor adapter over a
 * stand-in connection. It is written to be pointed at a real device connection
 * unchanged: hand it a subject whose `create` opens through
 * `useCapacitorSqlPersistence`, and the same five promises are checked against
 * the plugin, the native layer and a real file — which is where the DDL and the
 * busy timeout can finally be checked too.
 *
 * What it does not cover is anything requiring two connections or a suspended
 * process: those are the device's own territory and a fake would only pretend.
 */
export interface DatabaseStore {
  /** Opens the database. Calling it again is a relaunch over the same data. */
  open(): Promise<IDatabase>
}

export interface ConformanceSubject {
  /** Names the lane in the test output. */
  readonly name: string

  /** A store nothing has written to yet. */
  create(): Promise<DatabaseStore>
}

const CREATE_NOTES = 'CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, body TEXT)'

const insert = (db: IDatabase, id: string) =>
  db.execute('INSERT INTO notes (id, body) VALUES (?, ?)', [id, 'written'])

const ids = async (db: IDatabase): Promise<string[]> => {
  const rows = await db.query<{ id: string }>('SELECT id FROM notes ORDER BY id')
  return rows.map((row) => row.id)
}

export function describeDatabaseConformance(subject: ConformanceSubject): void {
  describe(`${subject.name}: the IDatabase port`, () => {
    const opened = async (): Promise<{ store: DatabaseStore; db: IDatabase }> => {
      const store = await subject.create()
      const db = await store.open()
      await db.execute(CREATE_NOTES)

      return { store, db }
    }

    it('keeps what a transaction commits', async () => {
      const { db } = await opened()

      await db.transaction(async () => {
        await insert(db, 'committed')
      })

      expect(await ids(db)).toEqual(['committed'])
    })

    it('keeps nothing a transaction rolled back', async () => {
      const { db } = await opened()

      await expect(
        db.transaction(async () => {
          await insert(db, 'undone')
          throw new Error('the block failed')
        }),
      ).rejects.toThrow('the block failed')

      expect(await ids(db)).toEqual([])
    })

    it('still takes transactions after one failed', async () => {
      // The one that matters most. A rollback can fail on a device, and a
      // transaction left open there is not a lost write — it is every later
      // write refused with "cannot start a transaction within a transaction"
      // until the app is restarted.
      const { db } = await opened()

      await expect(
        db.transaction(async () => {
          await insert(db, 'undone')
          throw new Error('the block failed')
        }),
      ).rejects.toThrow('the block failed')

      await db.transaction(async () => {
        await insert(db, 'after')
      })

      expect(await ids(db)).toEqual(['after'])
    })

    it('refuses transactions while suspended and takes them again after resume', async () => {
      const { db } = await opened()
      await db.suspend()

      await expect(db.transaction(async () => insert(db, 'blocked'))).rejects.toBeInstanceOf(
        DatabaseSuspendedError,
      )

      // A suspended database still reads: reads hold no lock across an await,
      // and the lock is what the system punishes.
      expect(await ids(db)).toEqual([])

      db.resume()
      await db.transaction(async () => insert(db, 'resumed'))

      expect(await ids(db)).toEqual(['resumed'])
    })

    it('has what it committed when it is opened again', async () => {
      const { store, db } = await opened()

      await db.transaction(async () => {
        await insert(db, 'durable')
      })

      await db.save()
      await db.close()

      const reopened = await store.open()
      expect(await ids(reopened)).toEqual(['durable'])
    })
  })
}
