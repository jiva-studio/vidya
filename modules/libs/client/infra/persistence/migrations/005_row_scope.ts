import type { Migration } from './types'

/**
 * The scope a row arrived on, recorded beside the row.
 *
 * Which grant carries a document is the server's decision, stamped on the
 * envelope, and the device cannot recompute it: `school_id` and `course_id`
 * say what a row is about rather than who was given it, and the user scope has
 * no column at all. With the pair written down, taking a withdrawn scope off
 * the device is one delete per table and no collection needs a branch of its
 * own.
 *
 * The columns are useless on a row that arrived before them, and a row with no
 * scope written down is a row no revocation can find — so the synced tables are
 * emptied and the read positions dropped in the same step. A scope with no
 * cursor starts at zero and is pulled down whole, stamped this time, which
 * makes the invariant hold for every device rather than only for a fresh one.
 *
 * The outbox is left alone: it holds work of the student's own that no server
 * has taken yet, and no pull will bring it back.
 *
 * The tables are named here rather than read from the collection list, because
 * an applied migration is frozen: a device that has already run this one will
 * never run it again, whatever the list says later.
 */
export const migration_005_row_scope: Migration = {
  name: '005_row_scope',
  up: async (db) => {
    for (const table of SYNCED_TABLES) {
      await db.execute(`ALTER TABLE "${table}" ADD COLUMN scope_kind TEXT`)
      await db.execute(`ALTER TABLE "${table}" ADD COLUMN scope_id TEXT`)
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_${table}_scope
           ON "${table}" (owner_id, scope_kind, scope_id)`,
      )
      await db.execute(`DELETE FROM "${table}"`)
    }

    await db.execute('DELETE FROM sync_doc_hlc')
    await db.execute('DELETE FROM sync_scopes')
    await db.execute('UPDATE sync_state SET acked_seq = 0')
  },
}

const SYNCED_TABLES = [
  'schools',
  'courses',
  'groups',
  'lessons',
  'lesson_versions',
  'enrollments',
  'homework',
  'block_states',
] as const
