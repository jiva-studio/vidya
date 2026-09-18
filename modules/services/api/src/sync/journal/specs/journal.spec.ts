import { INestApplication } from '@nestjs/common'
import { BlockStatesService, HomeworkService, LessonVersionsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { MIGRATIONS_DIR, testDatabase } from '@vidya/api/shared/datasources'
import { runMigrations } from '@vidya/api/shared/migrations'
import { COLLECTION_PROJECTIONS, SYNCED_ENTITY_NAMES, withSyncWriteContext } from '@vidya/api/sync'
import { asId, BlockId, SectionId, UserId } from '@vidya/domain'
import { Course, Enrollment } from '@vidya/entities'
import { DataSource } from 'typeorm'
import { v4 as uuid } from 'uuid'

import { createJournalContext, JournalContext, journalFor, journalRows } from './context'

const MIGRATION = '019_sync_journal.sql'

/**
 * Two things the in-memory database cannot model, and would silently pass.
 *
 * Its `CREATE TABLE IF NOT EXISTS` refuses the second run outright, and it does
 * not roll a transaction back at all — so a test of "the rollback took the
 * journal row with it" would be green there no matter what the code did.
 */
const itOnPostgres = testDatabase() === 'postgres' ? it : it.skip

describe('sync journal', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: JournalContext

  beforeEach(async () => {
    app = await createTestingApp()
    ds = app.get(DataSource)
    ctx = await createJournalContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  /* ------------------------------- T-S-1 -------------------------------- */

  describe('T-S-1: migration 019', () => {
    it('is recorded in schema_migrations', async () => {
      const rows = await ds.query('SELECT name FROM schema_migrations')

      expect(rows.map((r: { name: string }) => r.name)).toContain(MIGRATION)
    })

    itOnPostgres('is idempotent: a second run applies nothing and leaves one record', async () => {
      const client = {
        query: async <T>(sql: string, params?: unknown[]) => ({
          rows: (await ds.query(sql, params as unknown[])) as T[],
        }),
      }

      const applied = await runMigrations(client, MIGRATIONS_DIR)

      expect(applied).toEqual([])

      const rows = await ds.query('SELECT name FROM schema_migrations WHERE name = $1', [MIGRATION])
      expect(rows).toHaveLength(1)
    })

    it('creates the table with every column the journal writes', async () => {
      // Naming the columns fails loudly if one was renamed or dropped; the
      // impossible predicate keeps it a check of the schema, not of the rows.
      await expect(
        ds.query(
          `SELECT global_seq, collection, doc_id, op, data, hlc,
                  scope_kind, scope_id, school_id, device_id, author_id, created_at
             FROM sync_journal
            WHERE global_seq < 0`,
        ),
      ).resolves.toEqual([])
    })
  })

  /* ------------------------------- T-S-2 -------------------------------- */

  describe('T-S-2: one transaction for the domain row and its journal row', () => {
    itOnPostgres('rolls both back when the transaction fails', async () => {
      const before = await journalRows(ds)

      const failure = ds.transaction(async (manager) => {
        await manager.save(Course, {
          name: 'Rolled back',
          learningType: 'individual',
          schoolId: ctx.school.id,
        })

        throw new Error('deliberate failure after the write')
      })

      await expect(failure).rejects.toThrow('deliberate failure')

      const courses = await ds.query('SELECT id FROM courses WHERE name = $1', ['Rolled back'])
      expect(courses).toHaveLength(0)

      // The journal row was written through the same manager, so it went with it.
      expect(await journalRows(ds)).toHaveLength(before.length)
    })

    it('commits both together', async () => {
      const course = await ds.transaction(async (manager) =>
        manager.save(Course, {
          name: 'Committed',
          learningType: 'individual',
          schoolId: ctx.school.id,
        }),
      )

      const rows = await journalFor(ds, 'courses')
      expect(rows.map((r) => r.doc_id)).toContain(course.id)
    })
  })

  /* ------------------------------- T-S-3 -------------------------------- */

  describe('T-S-3: the subscriber is the only writer', () => {
    it('writes exactly one row for a write made under a push context', async () => {
      const blockStates = app.get(BlockStatesService)
      const hlc = '000001700000000000-000000-device-a'

      const state = await withSyncWriteContext(
        { hlc, deviceId: 'device-a', authorId: asId<UserId>(ctx.student.id) },
        () =>
          blockStates.create({
            enrollmentId: ctx.enrollment.id,
            lessonVersionId: ctx.draft.id,
            blockId: asId<BlockId>(uuid()),
            schoolId: ctx.school.id,
            state: { type: 'video', watched: 12, duration: 60 },
          }),
      )

      const rows = (await journalFor(ds, 'block_states')).filter((r) => r.doc_id === state.id)

      // Two rows here would mean a second writer — a push that journals on its
      // own as well as saving the row the subscriber then journals (Д-2).
      expect(rows).toHaveLength(1)
      expect(rows[0].hlc).toBe(hlc)
      expect(rows[0].device_id).toBe('device-a')
      expect(rows[0].author_id).toBe(ctx.student.id)
    })
  })

  /* ---------------------------- T-S-4, T-S-5 ---------------------------- */

  describe('T-S-4: drafts never reach the journal', () => {
    it('journals nothing when a draft is created', async () => {
      // The fixture already created one, and creating another changes nothing.
      const versions = app.get(LessonVersionsService)
      await versions.saveDraft(ctx.lesson.id, ctx.draft.id, ctx.draft.content)

      expect(await journalFor(ds, 'lesson_versions')).toHaveLength(0)
    })
  })

  describe('T-S-5: publishing journals the version once', () => {
    it('writes exactly one row, addressed to the course', async () => {
      const versions = app.get(LessonVersionsService)

      const published = await versions.publish(ctx.lesson.id, ctx.draft.id)

      const rows = await journalFor(ds, 'lesson_versions')
      expect(rows).toHaveLength(1)
      expect(rows[0].doc_id).toBe(published.id)
      expect(rows[0].op).toBe('upsert')
      expect(rows[0].scope_kind).toBe('course')
      expect(rows[0].scope_id).toBe(ctx.course.id)
      expect(rows[0].data).toMatchObject({ status: 'published', lessonId: ctx.lesson.id })
    })
  })

  /* ------------------------------- T-S-6 -------------------------------- */

  describe('T-S-6: the scope comes from the projection table', () => {
    it('addresses course-side collections to their course', async () => {
      const courses = await journalFor(ds, 'courses')
      const lessons = await journalFor(ds, 'lessons')

      expect(courses[0]).toMatchObject({ scope_kind: 'course', scope_id: ctx.course.id })
      expect(lessons[0]).toMatchObject({ scope_kind: 'course', scope_id: ctx.course.id })
    })

    it('addresses student-side collections to their student', async () => {
      const homework = app.get(HomeworkService)

      await homework.create({
        enrollmentId: ctx.enrollment.id,
        lessonVersionId: ctx.draft.id,
        sectionId: asId<SectionId>(uuid()),
        schoolId: ctx.school.id,
        text: 'my answer',
      })

      const enrollments = await journalFor(ds, 'enrollments')
      const answers = await journalFor(ds, 'homework')

      expect(enrollments[0]).toMatchObject({ scope_kind: 'user', scope_id: ctx.student.id })
      expect(answers[0]).toMatchObject({ scope_kind: 'user', scope_id: ctx.student.id })
    })

    it('carries the school on every row', async () => {
      const rows = await journalRows(ds)

      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r) => r.school_id === ctx.school.id)).toBe(true)
    })

    it('journals a removal as a tombstone with no body', async () => {
      await ds.getRepository(Enrollment).remove(
        await ds.getRepository(Enrollment).findOneBy({
          id: ctx.enrollment.id,
        }),
      )

      const rows = await journalFor(ds, 'enrollments')
      const tombstone = rows[rows.length - 1]

      expect(tombstone.op).toBe('delete')
      expect(tombstone.doc_id).toBe(ctx.enrollment.id)
      expect(tombstone.data).toBeNull()
    })
  })

  /* ------------------------------- T-S-7 -------------------------------- */

  describe('T-S-7: the projection table covers everything that syncs', () => {
    it('has a projection for every synchronised entity', () => {
      const missing = SYNCED_ENTITY_NAMES.filter((name) => !COLLECTION_PROJECTIONS[name])

      // An entity declared as synchronised without a projection has no scope and
      // no wire shape: it would leave the server silently unjournalled.
      expect(missing).toEqual([])
    })

    it('projects nothing that is not declared as synchronised', () => {
      const extra = Object.keys(COLLECTION_PROJECTIONS).filter(
        (name) => !SYNCED_ENTITY_NAMES.includes(name),
      )

      expect(extra).toEqual([])
    })

    it('gives every collection a distinct name and a known scope kind', () => {
      const projections = Object.values(COLLECTION_PROJECTIONS)
      const names = projections.map((p) => p.collection)

      expect(new Set(names).size).toBe(names.length)
      expect(projections.every((p) => ['school', 'course', 'user'].includes(p.scopeKind))).toBe(
        true,
      )
    })
  })

  /* ------------------------------- T-S-8 -------------------------------- */

  describe('T-S-8: a REST write is journalled with no device', () => {
    it('stamps a server HLC and leaves device_id null', async () => {
      const rows = await journalFor(ds, 'courses')

      expect(rows).toHaveLength(1)
      expect(rows[0].device_id).toBeNull()
      expect(rows[0].author_id).toBeNull()
      expect(rows[0].hlc).toMatch(/^\d{15}-\d{6}-server$/)
    })

    it('issues server stamps that only ever go up', async () => {
      const courses = await journalFor(ds, 'courses')
      const lessons = await journalFor(ds, 'lessons')
      const stamps = [...courses, ...lessons].map((r) => r.hlc)

      // Zero padding is what makes the text order the causal order; without it
      // `max(hlc)` would seed the clock from the wrong row on restart.
      expect([...stamps].sort()).toEqual(stamps)
    })
  })
})
