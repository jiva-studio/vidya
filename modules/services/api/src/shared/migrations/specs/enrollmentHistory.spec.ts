import { testingDataSource } from '@vidya/api/shared/datasources'
import { DataSource } from 'typeorm'
import { v4 as uuid } from 'uuid'

/**
 * The four migrations that turn a place on a course into a history.
 *
 * `testingDataSource()` applies the real `.sql` files to an empty database
 * before every suite, so reaching this file at all is already the "they apply
 * on a clean schema" case. What it cannot say is whether they applied the
 * *intended* change, and two of these are the kind whose mistake is invisible
 * until someone's row is refused on their phone.
 *
 * The last case is the one a routine set of migration tests walks past.
 * Dropping `UQ_enrollments_course_student` for a partial unique index buys
 * history, and the price is that the index no longer guards a row that *moves*
 * into a live status. A finished attempt brought back to `pending` while a
 * newer live one exists is two live places on one course — which is exactly
 * what the restore path in §4.6 tries to do, and exactly what the index has to
 * refuse rather than allow.
 */

const LIVE = ['pending', 'accepted'] as const
const FINISHED = ['declined', 'revoked', 'withdrawn'] as const

interface World {
  schoolId: string
  courseId: string
  studentId: string
}

/** The SQLSTATE a statement failed with, or `null` when it did not fail. */
const codeOf = async (work: Promise<unknown>): Promise<string | null> => {
  try {
    await work
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message
  }
}

/** Unique violation — what the applier has to recognise and answer with. */
const UNIQUE_VIOLATION = '23505'

describe('migrations 024-027: a place on a course becomes a history', () => {
  let ds: DataSource
  let world: World

  const enrol = async (
    status: string,
    overrides: Record<string, unknown> = {},
  ): Promise<string> => {
    const id = (overrides.id as string) ?? uuid()

    await ds.query(
      `INSERT INTO "enrollments" ("id", "courseId", "studentId", "schoolId", "status", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        world.courseId,
        world.studentId,
        world.schoolId,
        status,
        (overrides.createdAt as string) ?? new Date().toISOString(),
      ],
    )

    return id
  }

  beforeEach(async () => {
    ds = await testingDataSource()

    const schoolId = uuid()
    const courseId = uuid()
    const studentId = uuid()

    await ds.query(`INSERT INTO "schools" ("id", "name") VALUES ($1, $2)`, [schoolId, 'A school'])
    await ds.query(`INSERT INTO "users" ("id", "email") VALUES ($1, $2)`, [
      studentId,
      `${studentId}@example.org`,
    ])
    await ds.query(
      `INSERT INTO "courses" ("id", "name", "schoolId", "learningType")
       VALUES ($1, $2, $3, 'group')`,
      [courseId, `Course ${courseId}`, schoolId],
    )

    world = { schoolId, courseId, studentId }
  })

  afterEach(async () => {
    await ds.destroy()
  })

  /* ------------------------------- -------------------------------- */

  describe('they are on the clean schema this suite was given', () => {
    it('records all four by name', async () => {
      const rows = (await ds.query('SELECT name FROM schema_migrations')) as { name: string }[]

      expect(rows.map((row) => row.name)).toEqual(
        expect.arrayContaining([
          '024_enrollment_request_details.sql',
          '025_enrollment_withdrawn.sql',
          '026_enrollment_archiving.sql',
          '027_enrollment_history.sql',
        ]),
      )
    })

    it('024 adds the request the student writes, in snake_case', async () => {
      // Named one by one, and behind an impossible predicate: this reads the
      // schema, not the rows. A column renamed to camelCase would pass a
      // `SELECT *` and land the device's projection on nothing.
      await expect(
        ds.query(
          `SELECT preferred_group_id, preferred_times, comment
             FROM "enrollments" WHERE "id" = '00000000-0000-0000-0000-000000000000'`,
        ),
      ).resolves.toEqual([])
    })

    it('026 adds a stamp for each side, and the name of who put the school one on', async () => {
      await expect(
        ds.query(
          `SELECT archived_by_student_at, archived_by_school_at, archived_by_school_by_id
             FROM "enrollments" WHERE "id" = '00000000-0000-0000-0000-000000000000'`,
        ),
      ).resolves.toEqual([])
    })
  })

  /* ------------------------------- -------------------------------- */

  describe('025: leaving a course is a status the check constraint knows', () => {
    it('accepts a withdrawn place', async () => {
      await expect(enrol('withdrawn')).resolves.toEqual(expect.any(String))
    })

    it('still refuses a status nobody defined', async () => {
      expect(await codeOf(enrol('abandoned'))).not.toBeNull()
    })
  })

  /* ------------------------------- -------------------------------- */

  describe('027: many attempts, one of them live', () => {
    it('lets a student try the same course again and again', async () => {
      for (const status of FINISHED) {
        await expect(enrol(status)).resolves.toEqual(expect.any(String))
      }

      const rows = (await ds.query(
        `SELECT "id" FROM "enrollments" WHERE "courseId" = $1 AND "studentId" = $2`,
        [world.courseId, world.studentId],
      )) as unknown[]

      expect(rows).toHaveLength(FINISHED.length)
    })

    it.each(LIVE)('refuses a second live place beside a %s one', async (status) => {
      await enrol(status)

      expect(await codeOf(enrol('pending'))).toBe(UNIQUE_VIOLATION)
    })

    it('lets a finished attempt sit beside a live one', async () => {
      await enrol('declined')

      await expect(enrol('pending')).resolves.toEqual(expect.any(String))
    })

    it('refuses to bring a finished attempt back while a newer live one exists', async () => {
      // The trap of a partial unique index: it guards INSERT obviously and
      // UPDATE quietly. Restoring a withdrawn student (§4.6) is an UPDATE from
      // a status outside the predicate to one inside it, and if that is not
      // refused the student holds two places on one course and the school
      // decides twice.
      const finished = await enrol('withdrawn')
      await enrol('pending')

      expect(
        await codeOf(
          ds.query(`UPDATE "enrollments" SET "status" = 'accepted' WHERE "id" = $1`, [finished]),
        ),
      ).toBe(UNIQUE_VIOLATION)
    })

    it('lets a finished attempt come back once nothing live is in the way', async () => {
      const finished = await enrol('withdrawn')

      expect(
        await codeOf(
          ds.query(`UPDATE "enrollments" SET "status" = 'accepted' WHERE "id" = $1`, [finished]),
        ),
      ).toBeNull()
    })
  })
})
