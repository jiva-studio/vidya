import type { IDatabase } from '../../../ports'
import type { Migration } from './types'

/**
 * The local schema: the six synced collections plus the sync bookkeeping.
 *
 * Three properties are built in from the first release, because changing any of
 * them later means migrating databases that already live on students' phones.
 * `owner_id` sits on every synced row: there is one database per installation
 * rather than one per account, so two identities' rows sit side by side and
 * every read, cursor and HLC pointer filters by owner — signing out erases
 * nothing and signing back in works offline. `school_id` sits on every synced
 * row because a student can study at several schools at once. And there are no
 * foreign keys: scope positions advance independently, so homework legitimately
 * arrives before the lesson version it answers, and a foreign key would turn
 * that legal order into a failed insert that takes the whole page down. The UI
 * survives a missing parent instead.
 *
 * Statuses are plain `TEXT` with no `CHECK`, so a value only a newer server
 * knows is stored rather than rejected. All instants are ISO 8601 UTC strings,
 * which sort lexicographically in chronological order; a table carries a time
 * column only when the wire carries that time, because a column the server
 * never fills holds an empty string and sorts before every real instant.
 */
export const migration_001_local_schema: Migration = {
  name: '001_local_schema',
  up: async (db) => {
    await createContentTables(db)
    await createStudentTables(db)
    await createSyncTables(db)
    await createIndexes(db)
  },
}

/** Course material: pulled down, never edited here. */
async function createContentTables(db: IDatabase): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      id            TEXT NOT NULL,
      owner_id      TEXT NOT NULL,
      school_id     TEXT NOT NULL,
      name          TEXT NOT NULL,
      description   TEXT,
      learning_type TEXT NOT NULL,
      PRIMARY KEY (owner_id, id)
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS lessons (
      id            TEXT    NOT NULL,
      owner_id      TEXT    NOT NULL,
      school_id     TEXT    NOT NULL,
      course_id     TEXT    NOT NULL,
      lesson_number INTEGER NOT NULL,
      title         TEXT    NOT NULL,
      PRIMARY KEY (owner_id, id)
    )
  `)

  // `content` is the whole lesson as JSON, frozen at publication: homework
  // points at a version precisely because a published version cannot change
  // underneath the answer. `deleted_at` is the tombstone — it marks a version
  // withdrawn upstream and must not cascade to the homework written against
  // it, which stays readable.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS lesson_versions (
      id           TEXT    NOT NULL,
      owner_id     TEXT    NOT NULL,
      school_id    TEXT    NOT NULL,
      lesson_id    TEXT    NOT NULL,
      version      INTEGER NOT NULL,
      content      TEXT    NOT NULL,
      status       TEXT    NOT NULL,
      published_at TEXT,
      deleted_at   TEXT,
      PRIMARY KEY (owner_id, id)
    )
  `)
}

/** The student's own rows: written here, pushed up, decided upstream. */
async function createStudentTables(db: IDatabase): Promise<void> {
  // `deleted_at` has no writer: a request that ends says so in its status, and
  // the server has no such column for enrolments at all.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id             TEXT NOT NULL,
      owner_id       TEXT NOT NULL,
      school_id      TEXT NOT NULL,
      course_id      TEXT NOT NULL,
      group_id       TEXT,
      student_id     TEXT NOT NULL,
      status         TEXT NOT NULL,
      decided_by_id  TEXT,
      decided_at     TEXT,
      created_at     TEXT NOT NULL,
      deleted_at     TEXT,
      PRIMARY KEY (owner_id, id)
    )
  `)

  // One answer to one section of one lesson version. `status` and `grade` only
  // ever arrive from the server; `text` only ever goes up. The two sides never
  // write the same column, which is why there is nothing here to merge.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS homework (
      id                          TEXT    NOT NULL,
      owner_id                    TEXT    NOT NULL,
      school_id                   TEXT    NOT NULL,
      enrollment_id               TEXT    NOT NULL,
      lesson_version_id           TEXT    NOT NULL,
      section_id                  TEXT    NOT NULL,
      status                      TEXT    NOT NULL,
      text                        TEXT    NOT NULL DEFAULT '',
      grade                       INTEGER,
      answered_superseded_version INTEGER NOT NULL DEFAULT 0,
      reviewed_by_id              TEXT,
      submitted_at                TEXT,
      reviewed_at                 TEXT,
      created_at                  TEXT    NOT NULL,
      PRIMARY KEY (owner_id, id)
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS block_states (
      id                TEXT NOT NULL,
      owner_id          TEXT NOT NULL,
      school_id         TEXT NOT NULL,
      enrollment_id     TEXT NOT NULL,
      lesson_version_id TEXT NOT NULL,
      block_id          TEXT NOT NULL,
      state             TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      PRIMARY KEY (owner_id, id)
    )
  `)
}

/** Bookkeeping the sync engine owns. */
async function createSyncTables(db: IDatabase): Promise<void> {
  // Append-only journal of local changes. A domain write and its outbox row go
  // in the same transaction, so a change and its record of that change are
  // atomic. `status` is `pending | pushed | rejected` and `reason` explains a
  // refusal: a rejected row keeps its place on the device with the reason
  // attached, which is why the watermark steps past it rather than retrying it
  // forever. Rows are never deleted. Never.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS outbox (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      collection TEXT    NOT NULL,
      doc_id     TEXT    NOT NULL,
      op         TEXT    NOT NULL,
      data       TEXT,
      hlc        TEXT    NOT NULL,
      base_hlc   TEXT,
      owner_id   TEXT    NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'pending',
      reason     TEXT,
      created_at TEXT    NOT NULL
    )
  `)

  // The highest server HLC seen per document, so applying an incoming row can
  // be conditional and a late arrival cannot roll newer data back.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_doc_hlc (
      owner_id   TEXT NOT NULL,
      collection TEXT NOT NULL,
      doc_id     TEXT NOT NULL,
      server_hlc TEXT NOT NULL,
      PRIMARY KEY (owner_id, collection, doc_id)
    )
  `)

  // Per identity and installation: how far the server has been told we have
  // read, and the outbox watermark below which rows are settled.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_state (
      device_id        TEXT    NOT NULL,
      owner_id         TEXT    NOT NULL,
      acked_seq        INTEGER NOT NULL DEFAULT 0,
      pushed_outbox_id INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (device_id, owner_id)
    )
  `)

  // One read position per scope, advanced independently of the others — which
  // is exactly why the schema cannot afford foreign keys. A scope not yet
  // present starts at cursor 0, and that alone is what pulls a newly enrolled
  // course down in full. `checksum` is the server's summary to compare
  // against; `removed_at` marks a scope that left, whose rows are erased with
  // it.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_scopes (
      owner_id   TEXT    NOT NULL,
      kind       TEXT    NOT NULL,
      id         TEXT    NOT NULL,
      cursor     INTEGER NOT NULL DEFAULT 0,
      checksum   TEXT,
      removed_at TEXT,
      PRIMARY KEY (owner_id, kind, id)
    )
  `)
}

/**
 * Indexes for the reads the app actually makes.
 *
 * The unique ones are identity, not integrity: they say two rows describe the
 * same thing, and they are safe under out-of-order arrival because none of
 * them mentions a parent row that has to exist first.
 */
async function createIndexes(db: IDatabase): Promise<void> {
  const statements = [
    'CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons (owner_id, course_id)',
    'CREATE INDEX IF NOT EXISTS idx_lesson_versions_lesson ON lesson_versions (owner_id, lesson_id)',
    'CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments (owner_id, course_id)',
    'CREATE INDEX IF NOT EXISTS idx_homework_enrollment ON homework (owner_id, enrollment_id)',
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_homework_answer
       ON homework (owner_id, enrollment_id, lesson_version_id, section_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_block_states_block
       ON block_states (owner_id, enrollment_id, lesson_version_id, block_id)`,
    'CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox (owner_id, status, id)',
  ]

  for (const statement of statements) await db.execute(statement)
}
