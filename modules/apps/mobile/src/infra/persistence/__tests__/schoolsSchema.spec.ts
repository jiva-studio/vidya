import { describe, expect, it } from 'vitest'

import type { IDatabase } from '@/ports'

import {
  deviceMigrations,
  migration_000_migrations_table,
  migration_001_local_schema,
} from '../migrations'
import { listTables, openTestDatabase } from '../testing'

interface ColumnRow {
  name: string
  type: string
  notnull: number
  pk: number
}

const columnsOf = (db: IDatabase, table: string): Promise<ColumnRow[]> =>
  db.query<ColumnRow>(`PRAGMA table_info(${table})`)

/**
 * The school itself lives on the device, because a course card names its school
 * and a card drawn without a connection has nowhere else to read the name from.
 *
 * It arrives by its own migration rather than by an edit to the first one:
 * handsets in the field have already recorded `001_local_schema` as applied and
 * will never run it again, whatever it says afterwards.
 */
describe('the schools table on the device', () => {
  it('arrives in a migration appended after the frozen ones', () => {
    const names = deviceMigrations.map((migration) => migration.name)

    expect(names.slice(0, 2)).toEqual([
      migration_000_migrations_table.name,
      migration_001_local_schema.name,
    ])
    expect(names).toContain('002_schools')
  })

  it('exists once the device migrations have run', async () => {
    const { db } = await openTestDatabase()

    expect(await listTables(db)).toContain('schools')
  })

  it('holds the name and the two presentation fields', async () => {
    const { db } = await openTestDatabase()
    const names = (await columnsOf(db, 'schools')).map((column) => column.name)

    expect(names).toEqual(expect.arrayContaining(['id', 'owner_id', 'name', 'logo_url']))
    expect(names).toContain('description')
  })

  it('keys the table by owner and id, as every synced table is keyed', async () => {
    const { db } = await openTestDatabase()

    const key = (await columnsOf(db, 'schools'))
      .filter((column) => column.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((column) => column.name)

    expect(key).toEqual(['owner_id', 'id'])
  })

  it('refuses a row that does not say whose it is', async () => {
    const { db } = await openTestDatabase()
    const owner = (await columnsOf(db, 'schools')).find((column) => column.name === 'owner_id')

    expect(owner?.notnull).toBe(1)
  })

  it('reaches a database that already carries the first schema, keeping its rows', async () => {
    const images = new Map<string, Uint8Array>()
    const older = await openTestDatabase({
      images,
      migrations: [migration_000_migrations_table, migration_001_local_schema],
    })
    await older.db.execute(
      `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
       VALUES ('c-1', 'o-1', 's-1', 'Sanskrit', 'individual')`,
    )
    await older.db.close()

    // Stopped short of the scope stamp, which empties the synced tables on
    // purpose so every row comes back carrying the scope it arrived on.
    const upgraded = await openTestDatabase({
      images,
      migrations: deviceMigrations.slice(
        0,
        deviceMigrations.findIndex((migration) => migration.name === '005_row_scope'),
      ),
    })

    expect(await listTables(upgraded.db)).toContain('schools')
    expect(await upgraded.db.query('SELECT id FROM courses')).toHaveLength(1)
  })
})
