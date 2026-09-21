import { describe, expect, it } from 'vitest'

import type { IDatabase } from '@/ports'

import { deviceMigrations, runMigrations } from '../migrations'
import { fixedClock, listTables, openTestDatabase } from '../testing'

/**
 * The tables the device holds after every migration in the set has run.
 *
 * `runMigrations.spec.ts` proves the runner: once, in order, forward only.
 * It says nothing about what the migrations create, so a file that applies
 * cleanly and creates the wrong column is green there and fails later, as a
 * pulled row landing on a column nothing projects onto.
 *
 * Column names are snake_case here and camelCase on the wire —
 * `collectionProjections.ts` is the only translation between the two, and a
 * column created in the wire's spelling makes that table point at nothing.
 */

interface ColumnRow {
  name: string
  notnull: number
  pk: number
}

const columnsOf = async (db: IDatabase, table: string): Promise<ColumnRow[]> =>
  db.query<ColumnRow>(`PRAGMA table_info("${table}")`)

const namesOf = (columns: ColumnRow[]): string[] => columns.map((column) => column.name)

describe('the device schema the migration set builds', () => {
  it('carries both migrations this band adds, in append-only order', async () => {
    const names = deviceMigrations.map((migration) => migration.name)

    expect(names).toContain('003_groups')
    expect(names).toContain('004_enrollment_request_details')
    expect(names.indexOf('003_groups')).toBeGreaterThan(names.indexOf('002_schools'))
    expect(names.indexOf('004_enrollment_request_details')).toBeGreaterThan(
      names.indexOf('003_groups'),
    )
  })

  describe('003_groups', () => {
    it('creates the table a course catalogue is drawn from', async () => {
      const { db } = await openTestDatabase()

      expect(await listTables(db)).toContain('groups')
    })

    it('holds the school beside the course', async () => {
      const { db } = await openTestDatabase()

      // `school_id` is not decoration: the projection test requires every
      // collection to be addressable by `id` and `schoolId`, and the group
      // rides the school scope precisely because a student who has not
      // enrolled holds no course scope at all.
      expect(namesOf(await columnsOf(db, 'groups'))).toEqual(
        expect.arrayContaining([
          'id',
          'owner_id',
          'school_id',
          'course_id',
          'name',
          'description',
          'starts_at',
          'status',
        ]),
      )
    })

    it('keys a row by its owner as well as its id', async () => {
      const { db } = await openTestDatabase()
      const key = (await columnsOf(db, 'groups'))
        .filter((column) => column.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((column) => column.name)

      // Two students signed in on one handset must not share rows, and the
      // id alone is the server's id, which they would.
      expect(key).toEqual(['owner_id', 'id'])
    })
  })

  describe('004_enrollment_request_details', () => {
    it('adds what the student asked for, in the spelling the projection uses', async () => {
      const { db } = await openTestDatabase()

      expect(namesOf(await columnsOf(db, 'enrollments'))).toEqual(
        expect.arrayContaining([
          'preferred_group_id',
          'preferred_times',
          'comment',
          'archived_by_student_at',
        ]),
      )
    })

    it('leaves the archiving the school does off the device', async () => {
      const { db } = await openTestDatabase()
      const names = namesOf(await columnsOf(db, 'enrollments'))

      // It never reaches the wire, so a column for it here could only ever
      // hold a fallback and mislead whoever read it.
      expect(names).not.toContain('archived_by_school_at')
      expect(names).not.toContain('archived_by_school_by_id')
    })
  })

  /**
   * The scope columns are only worth having if every row carries them.
   *
   * A row that arrived before the columns existed answers to no scope, so
   * taking a withdrawn scope off the device would walk past it and leave
   * course material behind that the student is no longer allowed to read. The
   * migration therefore empties what it cannot stamp and drops the read
   * positions, so the same rows come back with the pair written on them.
   */
  describe('005_row_scope', () => {
    /** A database migrated up to, but not including, the scope columns. */
    const openBeforeScopes = async () => {
      const upToScopes = deviceMigrations.slice(0, deviceMigrations.length - 1)
      const { db } = await openTestDatabase({ migrations: upToScopes })

      return db
    }

    const countOf = async (db: IDatabase, table: string): Promise<number> => {
      const [row] = await db.query<{ total: number }>(`SELECT COUNT(*) AS total FROM "${table}"`)

      return row?.total ?? 0
    }

    const seedUnstampedRows = async (db: IDatabase): Promise<void> => {
      await db.execute(
        `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
         VALUES ('course-1', 'owner-a', 'school-1', 'Sanskrit', 'self_paced')`,
      )
      await db.execute(
        `INSERT INTO schools (id, owner_id, school_id, name)
         VALUES ('school-1', 'owner-a', 'school-1', 'The school')`,
      )
      await db.execute(
        `INSERT INTO sync_scopes (owner_id, kind, id, cursor, checksum)
         VALUES ('owner-a', 'school', 'school-1', 42, 'abc')`,
      )
      await db.execute(
        `INSERT INTO sync_doc_hlc (owner_id, collection, doc_id, server_hlc)
         VALUES ('owner-a', 'courses', 'course-1', '7')`,
      )
      await db.execute(
        `INSERT INTO sync_state (device_id, owner_id, acked_seq, pushed_outbox_id)
         VALUES ('device-1', 'owner-a', 99, 5)`,
      )
    }

    it('leaves no row behind that answers to no scope', async () => {
      const db = await openBeforeScopes()
      await seedUnstampedRows(db)

      await runMigrations(db, deviceMigrations, fixedClock)

      expect([await countOf(db, 'courses'), await countOf(db, 'schools')]).toEqual([0, 0])
    })

    it('drops the read positions, so the rows are pulled down again', async () => {
      const db = await openBeforeScopes()
      await seedUnstampedRows(db)

      await runMigrations(db, deviceMigrations, fixedClock)

      expect(await countOf(db, 'sync_scopes')).toBe(0)
      expect(await countOf(db, 'sync_doc_hlc')).toBe(0)
      const [state] = await db.query<{ acked_seq: number }>('SELECT acked_seq FROM sync_state')
      expect(state?.acked_seq).toBe(0)
    })

    it("keeps the student's own unsent work, which no pull will bring back", async () => {
      const db = await openBeforeScopes()
      await db.execute(
        `INSERT INTO outbox (collection, doc_id, op, data, hlc, owner_id, status, created_at)
         VALUES ('enrollments', 'doc-1', 'upsert', '{}', '1', 'owner-a', 'pending', '2026-09-18T00:00:00.000Z')`,
      )

      await runMigrations(db, deviceMigrations, fixedClock)

      expect(await countOf(db, 'outbox')).toBe(1)
    })
  })
})
