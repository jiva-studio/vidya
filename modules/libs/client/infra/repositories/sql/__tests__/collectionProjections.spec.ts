import type { SyncCollection } from '@vidya/domain'
import { SyncCollections } from '@vidya/domain'
import { describe, expect, it } from 'vitest'

import { openTestDatabase } from '../../../persistence/testing'
import {
  COLLECTION_PROJECTIONS,
  missingRequiredFields,
  payloadToRow,
  projectionOf,
  requiredFields,
  rowToPayload,
  toColumnValue,
  toFieldValue,
} from '../collectionProjections'
import { readSyncRow, writeSyncRow } from '../rowWriter'

/**
 * The projection table —.
 *
 * The table is what three callers agree through: the journal decorator, the
 * apply repository and the six reading repositories. Its completeness cannot be
 * a matter of remembering, so it is checked here against two things that move
 * on their own — `SyncCollections` in the domain, and the columns migration
 * `001` actually created.
 *
 * A collection added to the domain and forgotten here fails the first test. A
 * column renamed in the schema and forgotten here fails the second.
 */

interface ColumnRow {
  name: string
  notnull: number
}

describe('the collection projection table', () => {
  it('covers exactly the collections that replicate', () => {
    expect(Object.keys(COLLECTION_PROJECTIONS).sort()).toEqual([...SyncCollections].sort())
  })

  it('every projected column exists in the device schema', async () => {
    const { db } = await openTestDatabase()

    for (const collection of SyncCollections) {
      const projection = projectionOf(collection)
      const columns = await db.query<ColumnRow>(`PRAGMA table_info("${projection.table}")`)
      const names = columns.map((column) => column.name)

      expect(names).toContain('owner_id')
      for (const column of projection.columns) {
        expect(names).toContain(column.column)
      }
    }
  })

  it('every column the schema requires is either projected or defaulted', async () => {
    const { db } = await openTestDatabase()

    for (const collection of SyncCollections) {
      const projection = projectionOf(collection)
      const columns = await db.query<ColumnRow>(`PRAGMA table_info("${projection.table}")`)
      const projected = new Set(projection.columns.map((column) => column.column))

      const unmet = columns
        .filter((column) => column.notnull === 1 && column.name !== 'owner_id')
        .map((column) => column.name)
        .filter((name) => !projected.has(name))

      expect(unmet).toEqual([])
    }
  })

  it('only the two collections that carry tombstones declare one', () => {
    const withTombstones = SyncCollections.filter(
      (collection) => projectionOf(collection).tombstone !== null,
    )

    //: a withdrawn enrolment and an unpublished version are decisions that
    // stay visible. Nothing else is ever deleted rather than archived.
    expect([...withTombstones].sort()).toEqual(['enrollments', 'lesson_versions'])
  })

  it('every collection can be addressed: `id` and `schoolId` are always required', () => {
    for (const collection of SyncCollections) {
      expect(requiredFields(collection)).toContain('id')
      expect(requiredFields(collection)).toContain('schoolId')
    }
  })

  it('projects the catalogue of groups onto its own table', () => {
    // Read through a widened view so a missing collection arrives as a failed
    // expectation naming it rather than a compile error here.
    const table = COLLECTION_PROJECTIONS as Readonly<
      Record<string, { table: string; tombstone: string | null } | undefined>
    >

    expect(table.groups).toBeDefined()
    expect(table.groups?.table).toBe('groups')

    // No tombstone: a group that ends is a group whose status says so, and the
    // list above pins the two collections that carry one.
    expect(table.groups?.tombstone).toBeNull()
  })

  it('names every column a group card is drawn from', () => {
    const columns = projectionOf('groups' as SyncCollection).columns
    const fields = columns.map((column) => column.field)
    const bySpelling = Object.fromEntries(columns.map((column) => [column.field, column.column]))

    expect(fields).toEqual(
      expect.arrayContaining(['id', 'schoolId', 'courseId', 'name', 'description', 'status']),
    )

    // `startsAt` is what tells a closed group from one still recruiting, and a
    // time column filled with a fallback empty string sorts before every real
    // instant.
    expect(fields).toContain('startsAt')
    expect(bySpelling.startsAt).toBe('starts_at')
    expect(bySpelling.courseId).toBe('course_id')
  })

  it('stores the times a student offered as json, not as text', () => {
    const preferredTimes = projectionOf('enrollments').columns.find(
      (column) => column.field === 'preferredTimes',
    )

    // Stored as text it would come back a string, and every screen reading it
    // would have to parse it itself — or, worse, forget to.
    expect(preferredTimes).toBeDefined()
    expect(preferredTimes?.kind).toBe('json')
    expect(preferredTimes?.column).toBe('preferred_times')
  })

  it('names the four request columns the device keeps for an enrolment', () => {
    const bySpelling = Object.fromEntries(
      projectionOf('enrollments').columns.map((column) => [column.field, column.column]),
    )

    expect(bySpelling).toMatchObject({
      preferredGroupId: 'preferred_group_id',
      preferredTimes: 'preferred_times',
      comment: 'comment',
      archivedByStudentAt: 'archived_by_student_at',
    })
  })

  it('names the fields a payload is missing, and nothing else', () => {
    expect(missingRequiredFields('homework', {})).toEqual(requiredFields('homework'))
    expect(
      missingRequiredFields('homework', {
        id: 'a',
        schoolId: 'b',
        enrollmentId: 'c',
        lessonVersionId: 'd',
        sectionId: 'e',
      }),
    ).toEqual([])
  })

  it('a payload survives the round trip through a row', () => {
    const payload = {
      id: 'a41c7d02-33b5-4e8f-9c6a-71e204f5d8b3',
      schoolId: '5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915',
      lessonId: 'c92b48e1-0f77-4d35-a8b2-6e1d3c05f482',
      version: 3,
      content: { schemaVersion: 1, sections: [] },
      status: 'published',
      publishedAt: null,
      deletedAt: null,
    }

    const { columns, values } = payloadToRow('lesson_versions', payload)
    const row = Object.fromEntries(columns.map((column, index) => [column, values[index]!]))

    expect(rowToPayload('lesson_versions', row)).toEqual(payload)
  })

  it('drops a field the projection does not name, rather than the row', () => {
    const { columns } = payloadToRow('courses', {
      id: 'a',
      schoolId: 'b',
      name: 'Gita',
      astrologicalSign: 'libra',
    })

    expect(columns).not.toContain('astrologicalSign')
    expect(columns).toContain('name')
  })

  it('falls back to the column default when a field is absent', () => {
    const { columns, values } = payloadToRow('courses', { id: 'a', schoolId: 'b' })
    const row = Object.fromEntries(columns.map((column, index) => [column, values[index]!]))

    expect(row.name).toBe('')
    expect(row.learning_type).toBe('individual')
    expect(row.description).toBeNull()
  })

  it('stores each kind the way the column expects', () => {
    const json = { column: 'state', field: 'state', kind: 'json' } as const
    const boolean = { column: 'flag', field: 'flag', kind: 'boolean' } as const
    const integer = { column: 'n', field: 'n', kind: 'integer', fallback: 0 } as const
    const text = { column: 't', field: 't', kind: 'text' } as const

    expect(toColumnValue(json, { a: 1 })).toBe('{"a":1}')
    expect(toColumnValue(boolean, true)).toBe(1)
    expect(toColumnValue(boolean, false)).toBe(0)
    expect(toColumnValue(integer, '12')).toBe(12)
    expect(toColumnValue(integer, 'not a number')).toBe(0)
    expect(toColumnValue(text, 42)).toBe('42')

    expect(toFieldValue(json, '{"a":1}')).toEqual({ a: 1 })
    expect(toFieldValue(boolean, 1)).toBe(true)
    expect(toFieldValue(integer, '7')).toBe(7)
    expect(toFieldValue(text, null)).toBeNull()
  })

  it('hands back unparseable json as it was stored rather than throwing', () => {
    const json = { column: 'content', field: 'content', kind: 'json' } as const
    expect(toFieldValue(json, 'not json at all')).toBe('not json at all')
  })

  it('refuses a collection it has no projection for', () => {
    expect(() => projectionOf('grimoires' as never)).toThrow(/No projection/)
  })
})

/**
 * The times a pulled row lands with.
 *
 * A column the wire never fills is stored as an empty string, which sorts
 * before every real instant. `listByEnrollment` orders by `created_at`, so such
 * rows come back first, in whatever order SQLite happens to return — nothing
 * fails, and the list is simply wrong.
 */
describe('the times a pulled row lands with', () => {
  const OWNER = 'owner-a'
  const CREATED_AT = '2026-09-18T00:00:02.500Z'

  /** A homework row exactly as the server's journal projection sends it. */
  const wireHomework = {
    id: 'd7e93f41-5a0c-4b62-8e17-9c3d5f2a1b48',
    enrollmentId: '3a5c7e92-4b18-4d06-9f2e-1c8b6d4a3f57',
    lessonVersionId: 'a41c7d02-33b5-4e8f-9c6a-71e204f5d8b3',
    sectionId: 'b18f4c60-27d9-4e51-a3c8-5f0b9e2d7614',
    schoolId: '5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915',
    status: 'in_review',
    text: 'My answer to the first section.',
    grade: null,
    reviewedById: null,
    answeredSupersededVersion: false,
    submittedAt: '2026-09-17T00:00:00.000Z',
    reviewedAt: null,
    createdAt: CREATED_AT,
  }

  it('stores the instant the server sent it, not a fallback', async () => {
    const { db } = await openTestDatabase()

    await writeSyncRow(
      db,
      { owner: OWNER, collection: 'homework', docId: wireHomework.id },
      wireHomework,
    )

    const row = await readSyncRow(db, {
      owner: OWNER,
      collection: 'homework',
      docId: wireHomework.id,
    })

    expect(row?.created_at).toBe(CREATED_AT)
  })

  it('leaves no time column holding an empty string', async () => {
    const { db } = await openTestDatabase()

    await writeSyncRow(
      db,
      { owner: OWNER, collection: 'homework', docId: wireHomework.id },
      wireHomework,
    )

    const row = await readSyncRow(db, {
      owner: OWNER,
      collection: 'homework',
      docId: wireHomework.id,
    })

    // An empty string sorts before every real instant, so a column filled with
    // one is not a cosmetic gap: it silently reorders the student's answers.
    const empty = Object.entries(row ?? {})
      .filter(([column, value]) => column.endsWith('_at') && value === '')
      .map(([column]) => column)

    expect(empty).toEqual([])
  })
})
