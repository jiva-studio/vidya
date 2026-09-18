import { describe, expect, it } from 'vitest'

import type { IDatabase } from '@/ports'

import { listTables, openTestDatabase } from '../testing'

/** Every table the first migration declares, plus the bookkeeping one. */
const ALL_TABLES = [
  'block_states',
  'courses',
  'enrollments',
  'homework',
  'lesson_versions',
  'lessons',
  'migrations',
  'outbox',
  'sync_doc_hlc',
  'sync_scopes',
  'sync_state',
]

/** The collections that sync, and so carry both axes of the layout. */
const SYNCED_TABLES = [
  'block_states',
  'courses',
  'enrollments',
  'homework',
  'lesson_versions',
  'lessons',
]

interface ColumnRow {
  name: string
  type: string
  notnull: number
  pk: number
}

const columnsOf = (db: IDatabase, table: string): Promise<ColumnRow[]> =>
  db.query<ColumnRow>(`PRAGMA table_info(${table})`)

const columnNames = async (db: IDatabase, table: string): Promise<string[]> =>
  (await columnsOf(db, table)).map((column) => column.name).sort()

describe('the local schema', () => {
  /* ------------------------------ T-M-23 -------------------------------- */

  describe('T-M-23: the schema has no foreign keys at all', () => {
    it('declares no foreign key on any table', async () => {
      const { db } = await openTestDatabase()

      const offenders: string[] = []
      for (const table of await listTables(db)) {
        const keys = await db.query(`PRAGMA foreign_key_list(${table})`)
        if (keys.length > 0) offenders.push(table)
      }

      expect(offenders).toEqual([])
    })

    it('never writes REFERENCES into the stored schema', async () => {
      const { db } = await openTestDatabase()

      const objects = await db.query<{ name: string; sql: string | null }>(
        'SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL',
      )

      const offenders = objects
        .filter((object) => /\breferences\b/i.test(object.sql ?? ''))
        .map((object) => object.name)

      expect(offenders).toEqual([])
    })

    it('accepts a child row that arrives before its parent', async () => {
      // Scope positions advance independently, so homework (the `user` scope)
      // legitimately arrives before the lesson version it answers (a `course`
      // scope). With enforcement switched on, a foreign key anywhere in the
      // schema would turn that legal order into a failed insert and take the
      // whole page down with it.
      const { db } = await openTestDatabase()
      await db.execute('PRAGMA foreign_keys = ON')

      await db.execute(
        `INSERT INTO homework (
           id, owner_id, school_id, enrollment_id, lesson_version_id, section_id,
           status, text, created_at
         ) VALUES ('h-1', 'o-1', 's-1', 'e-missing', 'lv-missing', 'sec-1',
                   'open', '', '2026-09-18T00:00:00.000Z')`,
      )

      const rows = await db.query<{ id: string }>('SELECT id FROM homework')
      expect(rows).toHaveLength(1)
    })

    it('keeps the whole page when one row has no parent', async () => {
      const { db } = await openTestDatabase()
      await db.execute('PRAGMA foreign_keys = ON')

      await db.transaction(async () => {
        await db.execute(
          `INSERT INTO block_states (
             id, owner_id, school_id, enrollment_id, lesson_version_id, block_id,
             state, updated_at
           ) VALUES ('b-1', 'o-1', 's-1', 'e-missing', 'lv-missing', 'blk-1',
                     '{}', '2026-09-18T00:00:00.000Z')`,
        )
        await db.execute(
          `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
           VALUES ('c-1', 'o-1', 's-1', 'Course', 'group')`,
        )
      })

      const blocks = await db.query('SELECT id FROM block_states')
      const courses = await db.query('SELECT id FROM courses')
      expect(blocks).toHaveLength(1)
      expect(courses).toHaveLength(1)
    })
  })

  /* ------------------------------- tables -------------------------------- */

  describe('the tables it creates', () => {
    it('creates exactly the declared set', async () => {
      const { db } = await openTestDatabase()

      expect(await listTables(db)).toEqual(ALL_TABLES)
    })

    it.each(SYNCED_TABLES)('gives %s a non-null owner_id and school_id', async (table) => {
      const { db } = await openTestDatabase()
      const columns = await columnsOf(db, table)

      for (const name of ['owner_id', 'school_id']) {
        const column = columns.find((candidate) => candidate.name === name)
        expect(column, `${table}.${name} is missing`).toBeDefined()
        expect(column!.notnull, `${table}.${name} is nullable`).toBe(1)
      }
    })

    it.each(SYNCED_TABLES)(
      'keys %s by owner and id, so two identities never mix',
      async (table) => {
        const { db } = await openTestDatabase()
        const columns = await columnsOf(db, table)

        const key = columns
          .filter((column) => column.pk > 0)
          .sort((a, b) => a.pk - b.pk)
          .map((column) => column.name)

        expect(key).toEqual(['owner_id', 'id'])
      },
    )

    it('lets two identities hold the same document without collision', async () => {
      const { db } = await openTestDatabase()

      await db.execute(
        `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
         VALUES ('c-1', 'owner-a', 's-1', 'Course', 'group')`,
      )
      await db.execute(
        `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
         VALUES ('c-1', 'owner-b', 's-1', 'Course', 'group')`,
      )

      const mine = await db.query('SELECT id FROM courses WHERE owner_id = ?', ['owner-a'])
      expect(mine).toHaveLength(1)
    })
  })

  /* -------------------------- the sync bookkeeping ------------------------ */

  describe('the sync tables', () => {
    it('gives outbox the columns the engine writes', async () => {
      const { db } = await openTestDatabase()

      expect(await columnNames(db, 'outbox')).toEqual([
        'base_hlc',
        'collection',
        'created_at',
        'data',
        'doc_id',
        'hlc',
        'id',
        'op',
        'owner_id',
        'reason',
        'status',
      ])
    })

    it('numbers outbox rows monotonically, which is what the watermark reads', async () => {
      const { db } = await openTestDatabase()

      const insert = (docId: string) =>
        db.execute(
          `INSERT INTO outbox (collection, doc_id, op, data, hlc, owner_id, created_at)
           VALUES ('homework', ?, 'upsert', '{}', 'hlc-1', 'o-1', '2026-09-18T00:00:00.000Z')`,
          [docId],
        )

      await insert('d-1')
      await insert('d-2')

      const rows = await db.query<{ id: number }>('SELECT id FROM outbox ORDER BY id')
      expect(rows.map((row) => row.id)).toEqual([1, 2])
    })

    it('defaults a new outbox row to pending', async () => {
      const { db } = await openTestDatabase()

      await db.execute(
        `INSERT INTO outbox (collection, doc_id, op, data, hlc, owner_id, created_at)
         VALUES ('homework', 'd-1', 'upsert', '{}', 'hlc-1', 'o-1', '2026-09-18T00:00:00.000Z')`,
      )

      const rows = await db.query<{ status: string; reason: string | null }>(
        'SELECT status, reason FROM outbox',
      )
      expect(rows[0]).toEqual({ status: 'pending', reason: null })
    })

    it.each([
      ['sync_doc_hlc', ['collection', 'doc_id', 'owner_id', 'server_hlc']],
      ['sync_state', ['acked_seq', 'device_id', 'owner_id', 'pushed_outbox_id']],
      ['sync_scopes', ['checksum', 'cursor', 'id', 'kind', 'owner_id', 'removed_at']],
    ])('gives %s the columns the plan names', async (table, expected) => {
      const { db } = await openTestDatabase()

      expect(await columnNames(db, table)).toEqual(expected)
    })

    it('starts an unseen scope at position zero, which is what pulls a new course down', async () => {
      const { db } = await openTestDatabase()

      await db.execute(
        "INSERT INTO sync_scopes (owner_id, kind, id) VALUES ('o-1', 'course', 'c-1')",
      )

      const rows = await db.query<{ cursor: number }>('SELECT cursor FROM sync_scopes')
      expect(rows[0]!.cursor).toBe(0)
    })

    it('keys sync_state by device and owner', async () => {
      const { db } = await openTestDatabase()
      const columns = await columnsOf(db, 'sync_state')

      const key = columns
        .filter((column) => column.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((column) => column.name)

      expect(key).toEqual(['device_id', 'owner_id'])
    })
  })

  /* ------------------------------ instants -------------------------------- */

  describe('the instants it stores', () => {
    it('keeps them as UTC text, unchanged by the device time zone', async () => {
      const { db } = await openTestDatabase()
      const instant = '2026-09-18T21:30:00.000Z'

      await db.execute(
        `INSERT INTO homework (
           id, owner_id, school_id, enrollment_id, lesson_version_id, section_id,
           status, text, created_at, submitted_at
         ) VALUES ('h-1', 'o-1', 's-1', 'e-1', 'lv-1', 'sec-1', 'pending', 'answer', ?, ?)`,
        [instant, instant],
      )

      const rows = await db.query<{ submitted_at: string }>('SELECT submitted_at FROM homework')
      expect(rows[0]!.submitted_at).toBe(instant)
    })

    it('orders rows by the stored text, so no date has to be parsed to sort', async () => {
      const { db } = await openTestDatabase()

      const insert = (id: string, at: string) =>
        db.execute(
          `INSERT INTO homework (
             id, owner_id, school_id, enrollment_id, lesson_version_id, section_id,
             status, text, created_at
           ) VALUES (?, 'o-1', 's-1', 'e-1', ?, 'sec-1', 'open', '', ?)`,
          [id, id, at],
        )

      await insert('later', '2026-09-18T23:00:00.000Z')
      await insert('earlier', '2026-09-18T01:00:00.000Z')

      const rows = await db.query<{ id: string }>('SELECT id FROM homework ORDER BY created_at')
      expect(rows.map((row) => row.id)).toEqual(['earlier', 'later'])
    })
  })
})
