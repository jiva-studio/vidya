import { describe, expect, it } from 'vitest'

import type { IDatabase } from '@/ports'

import {
  deviceMigrations,
  EmptyMigrationSetError,
  type Migration,
  migration_000_migrations_table,
  runMigrations,
  SchemaAheadOfCodeError,
} from '../migrations'
import { useSqlJsPersistence } from '../sqljs'
import { fixedClock, listTables, openTestDatabase, TEST_NOW } from '../testing'

const appliedNames = async (db: IDatabase): Promise<string[]> => {
  const rows = await db.query<{ name: string }>('SELECT name FROM migrations ORDER BY name')
  return rows.map((row) => row.name)
}

/** Counts how many times each migration's `up` ran. */
const counting = (name: string, counters: Record<string, number>): Migration => ({
  name,
  up: async (db) => {
    counters[name] = (counters[name] ?? 0) + 1
    await db.execute(`CREATE TABLE IF NOT EXISTS ${name} (id TEXT NOT NULL PRIMARY KEY)`)
  },
})

describe('runMigrations', () => {
  /* ------------------------------- -------------------------------- */

  describe('migrations are idempotent, forward only, and recorded', () => {
    it('records every applied migration by name', async () => {
      const { db } = await openTestDatabase()

      expect(await appliedNames(db)).toEqual(deviceMigrations.map((m) => m.name))
    })

    it('stamps the applied row with the injected clock, in UTC', async () => {
      const { db } = await openTestDatabase()

      const rows = await db.query<{ applied_at: string }>(
        "SELECT applied_at FROM migrations WHERE name = '001_local_schema'",
      )

      expect(rows[0]!.applied_at).toBe(TEST_NOW)
      expect(rows[0]!.applied_at).toMatch(/Z$/)
    })

    it('runs each migration exactly once, however often it is invoked', async () => {
      const counters: Record<string, number> = {}
      const migrations = [
        migration_000_migrations_table,
        counting('one', counters),
        counting('two', counters),
      ]

      const persistence = useSqlJsPersistence()
      const db = await persistence.open('idempotent')

      await runMigrations(db, migrations, fixedClock)
      await runMigrations(db, migrations, fixedClock)
      await runMigrations(db, migrations, fixedClock)

      expect(counters).toEqual({ one: 1, two: 1 })
      expect(await appliedNames(db)).toEqual(['000_migrations_table', 'one', 'two'])
    })

    it('survives a relaunch: the second run of the real set changes nothing', async () => {
      const images = new Map<string, Uint8Array>()
      const first = await openTestDatabase({ images })
      const tablesAfterFirst = await listTables(first.db)
      await first.db.close()

      const second = await openTestDatabase({ images })

      expect(await listTables(second.db)).toEqual(tablesAfterFirst)
      expect(await appliedNames(second.db)).toEqual(deviceMigrations.map((m) => m.name))
    })

    it('applies only what is pending when the set grows', async () => {
      const counters: Record<string, number> = {}
      const one = counting('one', counters)
      const two = counting('two', counters)

      const persistence = useSqlJsPersistence()
      const db = await persistence.open('growing')

      await runMigrations(db, [migration_000_migrations_table, one], fixedClock)
      await runMigrations(db, [migration_000_migrations_table, one, two], fixedClock)

      expect(counters).toEqual({ one: 1, two: 1 })
    })

    it('goes forward only: a database migrated by a newer build is refused', async () => {
      const counters: Record<string, number> = {}
      const persistence = useSqlJsPersistence()
      const db = await persistence.open('downgraded')

      const newer = [
        migration_000_migrations_table,
        counting('one', counters),
        counting('two', counters),
      ]
      await runMigrations(db, newer, fixedClock)

      const older = newer.slice(0, 2)
      await expect(runMigrations(db, older, fixedClock)).rejects.toBeInstanceOf(
        SchemaAheadOfCodeError,
      )
    })

    it('treats an empty set as a packaging failure, not as success', async () => {
      const persistence = useSqlJsPersistence()
      const db = await persistence.open('empty')

      await expect(runMigrations(db, [], fixedClock)).rejects.toBeInstanceOf(EmptyMigrationSetError)
    })
  })

  /* ------------------------------- -------------------------------- */

  describe('a failure inside a migration leaves no half schema', () => {
    const boom = new Error('migration blew up halfway')

    const halfway: Migration = {
      name: 'halfway',
      up: async (db) => {
        await db.execute('CREATE TABLE IF NOT EXISTS first_half (id TEXT NOT NULL PRIMARY KEY)')
        throw boom
      },
    }

    it('rolls back the statements the failed migration did run', async () => {
      const persistence = useSqlJsPersistence()
      const db = await persistence.open('half')

      await expect(
        runMigrations(db, [migration_000_migrations_table, halfway], fixedClock),
      ).rejects.toBe(boom)

      expect(await listTables(db)).not.toContain('first_half')
    })

    it('does not record the migration it could not finish', async () => {
      const persistence = useSqlJsPersistence()
      const db = await persistence.open('half-record')

      await expect(
        runMigrations(db, [migration_000_migrations_table, halfway], fixedClock),
      ).rejects.toBe(boom)

      expect(await appliedNames(db)).toEqual(['000_migrations_table'])
    })

    it('keeps the migrations applied before it', async () => {
      const counters: Record<string, number> = {}
      const persistence = useSqlJsPersistence()
      const db = await persistence.open('half-earlier')

      const migrations = [migration_000_migrations_table, counting('one', counters), halfway]
      await expect(runMigrations(db, migrations, fixedClock)).rejects.toBe(boom)

      expect(await appliedNames(db)).toEqual(['000_migrations_table', 'one'])
      expect(await listTables(db)).toContain('one')
    })

    it('retries the unfinished migration on the next launch', async () => {
      const images = new Map<string, Uint8Array>()
      const persistence = useSqlJsPersistence({ images })
      const failing = await persistence.open('half-retry')

      await expect(
        runMigrations(failing, [migration_000_migrations_table, halfway], fixedClock),
      ).rejects.toBe(boom)
      await failing.close()

      let attempts = 0
      const fixed: Migration = {
        name: 'halfway',
        up: async (db) => {
          attempts += 1
          await db.execute('CREATE TABLE IF NOT EXISTS first_half (id TEXT NOT NULL PRIMARY KEY)')
          await db.execute('CREATE TABLE IF NOT EXISTS second_half (id TEXT NOT NULL PRIMARY KEY)')
        },
      }

      const relaunched = await persistence.open('half-retry')
      await runMigrations(relaunched, [migration_000_migrations_table, fixed], fixedClock)

      expect(attempts).toBe(1)
      expect(await listTables(relaunched)).toEqual(
        expect.arrayContaining(['first_half', 'second_half']),
      )
    })
  })
})
