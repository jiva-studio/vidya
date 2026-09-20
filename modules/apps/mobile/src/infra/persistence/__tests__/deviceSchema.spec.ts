import { describe, expect, it } from 'vitest'

import type { IDatabase } from '@/ports'

import { deviceMigrations } from '../migrations'
import { listTables, openTestDatabase } from '../testing'

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
})
