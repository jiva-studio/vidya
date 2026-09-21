import type { SyncCollection, SyncPayload } from '@vidya/domain'

import type { QueryValue, Row } from '@/ports'

/**
 * How each replicating collection is projected onto a local table.
 *
 * A table rather than three hand-written mappings, because three callers must
 * not disagree: the journal decorator turns a local write into an outbox
 * payload, the apply repository turns an incoming payload into a row, and the
 * reading repositories turn a row back into a payload. Wire field names are the
 * camelCase ones of `@vidya/protocol`; column names are the snake_case ones of
 * the device migrations. Nothing else translates between the two.
 *
 * A column exists here only when the wire carries its field. The two exceptions
 * are structural: `school_id` is folded in from the envelope by
 * `validateChange`, and a tombstone column is written by the `delete` op rather
 * than by any payload. Anything else named here and never sent arrives as its
 * fallback — and a fallback for a time is an empty string, which sorts before
 * every real instant and makes `ORDER BY` quietly wrong.
 *
 * Two properties are deliberate: an unknown field is ignored rather than
 * refused, because dropping a row a newer server sent is worse than dropping a
 * field; and a missing field is fatal only when it addresses the row, because a
 * partial row that can still be found beats no row at all.
 */

/** How a wire value is stored in, and read back from, a SQLite column. */
export type SyncColumnKind = 'text' | 'integer' | 'boolean' | 'json'

export interface SyncColumnProjection {
  /** Column in the local table. */
  readonly column: string

  /** Field name on the wire and in the outbox payload. */
  readonly field: string

  readonly kind: SyncColumnKind

  /**
   * When `true`, a payload without this field is refused and the row skipped.
   * Reserved for the keys that address the row — without them the row cannot
   * be found again, and storing it would be storing garbage.
   */
  readonly required?: boolean

  /** Value used when the payload omits the field. Defaults to `null`. */
  readonly fallback?: QueryValue
}

export interface CollectionProjection {
  readonly collection: SyncCollection
  readonly table: string

  /** The synced columns, `owner_id` excluded — that one is the disk layout. */
  readonly columns: readonly SyncColumnProjection[]

  /**
   * The column a `delete` sets instead of removing the row, or `null` when the
   * collection has no tombstone and a delete really removes it.
   *
   * Only `enrollments` and `lesson_versions` carry one, and only
   * `lesson_versions` has a writer: an unpublished version is a decision that
   * must stay visible. The enrolments column is written by nobody — a request
   * that ends says so in its status — and it stands as the shape of the
   * predicate rather than as a path anything takes. A tombstone never cascades
   * here — an unpublished version does not take the homework written against
   * it with it, or a student's work would vanish because an editor tidied up.
   */
  readonly tombstone: string | null
}

const text = (column: string, field: string, extra: Partial<SyncColumnProjection> = {}) =>
  ({ column, field, kind: 'text', ...extra }) as const

const KEY = { required: true } as const

const EMPTY = { fallback: '' } as const

export const COLLECTION_PROJECTIONS: Readonly<Record<SyncCollection, CollectionProjection>> =
  Object.freeze({
    schools: {
      collection: 'schools',
      table: 'schools',
      tombstone: null,
      columns: [
        text('id', 'id', KEY),
        // A school row is its own school. The envelope carries the field for
        // every collection alike, so it is projected like every other one.
        text('school_id', 'schoolId', { ...KEY, ...EMPTY }),
        text('name', 'name', EMPTY),
        text('logo_url', 'logoUrl'),
        text('description', 'description'),
      ],
    },

    courses: {
      collection: 'courses',
      table: 'courses',
      tombstone: null,
      columns: [
        text('id', 'id', KEY),
        text('school_id', 'schoolId', KEY),
        text('name', 'name', EMPTY),
        text('description', 'description'),
        text('learning_type', 'learningType', { fallback: 'individual' }),
      ],
    },

    // No tombstone: a group that ends says so in its status, and the device
    // needs the closed ones to know recruitment is over.
    groups: {
      collection: 'groups',
      table: 'groups',
      tombstone: null,
      columns: [
        text('id', 'id', KEY),
        text('school_id', 'schoolId', KEY),
        text('course_id', 'courseId', KEY),
        text('name', 'name', EMPTY),
        text('description', 'description'),
        text('starts_at', 'startsAt'),
        text('status', 'status', { fallback: 'pending' }),
      ],
    },

    lessons: {
      collection: 'lessons',
      table: 'lessons',
      tombstone: null,
      columns: [
        text('id', 'id', KEY),
        text('school_id', 'schoolId', KEY),
        text('course_id', 'courseId', KEY),
        { column: 'lesson_number', field: 'lessonNumber', kind: 'integer', fallback: 0 },
        text('title', 'title', EMPTY),
      ],
    },

    lesson_versions: {
      collection: 'lesson_versions',
      table: 'lesson_versions',
      tombstone: 'deleted_at',
      columns: [
        text('id', 'id', KEY),
        text('school_id', 'schoolId', KEY),
        text('lesson_id', 'lessonId', KEY),
        { column: 'version', field: 'version', kind: 'integer', required: true },
        // Stored whole, unknown `schemaVersion` included: the screen
        // offers an update, the engine never truncates what it was sent.
        { column: 'content', field: 'content', kind: 'json', fallback: '{}' },
        text('status', 'status', { fallback: 'published' }),
        text('published_at', 'publishedAt'),
        text('deleted_at', 'deletedAt'),
      ],
    },

    enrollments: {
      collection: 'enrollments',
      table: 'enrollments',
      tombstone: 'deleted_at',
      columns: [
        text('id', 'id', KEY),
        text('school_id', 'schoolId', KEY),
        text('course_id', 'courseId', KEY),
        text('group_id', 'groupId'),
        text('student_id', 'studentId', EMPTY),
        text('status', 'status', { fallback: 'pending' }),
        text('decided_by_id', 'decidedById'),
        text('decided_at', 'decidedAt'),
        text('created_at', 'createdAt', EMPTY),
        text('deleted_at', 'deletedAt'),
        text('preferred_group_id', 'preferredGroupId'),
        { column: 'preferred_times', field: 'preferredTimes', kind: 'json' },
        text('comment', 'comment'),
        text('archived_by_student_at', 'archivedByStudentAt'),
      ],
    },

    homework: {
      collection: 'homework',
      table: 'homework',
      tombstone: null,
      columns: [
        text('id', 'id', KEY),
        text('school_id', 'schoolId', KEY),
        text('enrollment_id', 'enrollmentId', KEY),
        text('lesson_version_id', 'lessonVersionId', KEY),
        text('section_id', 'sectionId', KEY),
        text('status', 'status', { fallback: 'open' }),
        text('text', 'text', EMPTY),
        { column: 'grade', field: 'grade', kind: 'integer' },
        {
          column: 'answered_superseded_version',
          field: 'answeredSupersededVersion',
          kind: 'boolean',
          fallback: 0,
        },
        text('reviewed_by_id', 'reviewedById'),
        text('submitted_at', 'submittedAt'),
        text('reviewed_at', 'reviewedAt'),
        text('created_at', 'createdAt', EMPTY),
      ],
    },

    block_states: {
      collection: 'block_states',
      table: 'block_states',
      tombstone: null,
      columns: [
        text('id', 'id', KEY),
        text('school_id', 'schoolId', KEY),
        text('enrollment_id', 'enrollmentId', KEY),
        text('lesson_version_id', 'lessonVersionId', KEY),
        text('block_id', 'blockId', KEY),
        { column: 'state', field: 'state', kind: 'json', fallback: '{}' },
        text('updated_at', 'updatedAt', EMPTY),
      ],
    },
  })

/**
 * The projection for `collection`.
 *
 * Throws on a collection that does not replicate: reaching here with one is a
 * programming error, because every path that handles untrusted input checks
 * `isSyncCollection` from the domain and skips the row long before this point
 * — the one guard, in the one place untrusted input arrives.
 */
export function projectionOf(collection: SyncCollection): CollectionProjection {
  const projection = COLLECTION_PROJECTIONS[collection]
  if (projection === undefined) throw new Error(`No projection for collection: ${collection}`)
  return projection
}

/** Names the fields a payload must carry for `collection` to be storable. */
export function requiredFields(collection: SyncCollection): readonly string[] {
  return projectionOf(collection)
    .columns.filter((column) => column.required === true)
    .map((column) => column.field)
}

/** The fields of `payload` that are missing and cannot be defaulted. */
export function missingRequiredFields(
  collection: SyncCollection,
  payload: SyncPayload,
): readonly string[] {
  return requiredFields(collection).filter(
    (field) => payload[field] === undefined || payload[field] === null,
  )
}

/**
 * Turn a wire value into what the column stores.
 *
 * A dispatch table rather than a chain of `if`s, so adding a kind is an entry
 * and not another branch in a function already at the complexity ceiling.
 */
const TO_COLUMN: Readonly<
  Record<SyncColumnKind, (value: unknown, column: SyncColumnProjection) => QueryValue>
> = Object.freeze({
  json: (value) => JSON.stringify(value),
  boolean: (value) => (value === true || value === 1 ? 1 : 0),
  integer: (value, column) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : (column.fallback ?? null)
  },
  text: (value) => (typeof value === 'string' ? value : String(value)),
})

export function toColumnValue(column: SyncColumnProjection, value: unknown): QueryValue {
  if (value === undefined || value === null) return column.fallback ?? null
  return TO_COLUMN[column.kind](value, column)
}

/** Turn a stored column back into the wire value. */
const TO_FIELD: Readonly<Record<SyncColumnKind, (value: unknown) => unknown>> = Object.freeze({
  json: (value) => parseJson(value),
  boolean: (value) => value === 1 || value === true,
  integer: (value) => Number(value),
  text: (value) => value,
})

export function toFieldValue(column: SyncColumnProjection, value: unknown): unknown {
  if (value === undefined || value === null) return null
  return TO_FIELD[column.kind](value)
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    // A column this build cannot parse is still the server's data. Handing the
    // raw text up beats throwing away a lesson because one field went odd.
    return value
  }
}

/**
 * Project a wire payload onto `(columns, values)` for the collection's table.
 *
 * Fields the projection does not name are dropped, and fields it names
 * but the payload omits fall back to the column default. `owner_id` is added by
 * the caller, which is the only thing that knows whose row this is.
 */
export function payloadToRow(
  collection: SyncCollection,
  payload: SyncPayload,
): { columns: string[]; values: QueryValue[] } {
  const projection = projectionOf(collection)
  const columns: string[] = []
  const values: QueryValue[] = []

  for (const column of projection.columns) {
    columns.push(column.column)
    values.push(toColumnValue(column, payload[column.field]))
  }

  return { columns, values }
}

/** Project a stored row back onto the wire payload the outbox and merge use. */
export function rowToPayload(collection: SyncCollection, row: Row): SyncPayload {
  const payload: SyncPayload = {}
  for (const column of projectionOf(collection).columns) {
    payload[column.field] = toFieldValue(column, row[column.column])
  }

  return payload
}
