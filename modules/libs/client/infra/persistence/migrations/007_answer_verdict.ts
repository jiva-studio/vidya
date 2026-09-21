import type { Migration } from './types'

/**
 * The server's answer to a student's, and the reviewer's words on their work.
 *
 * Both arrive filled from the server and are never written here, so neither
 * needs a default: a row that predates them simply has nothing to say yet.
 */
export const migration_007_answer_verdict: Migration = {
  name: '007_answer_verdict',
  up: async (db) => {
    await db.execute('ALTER TABLE block_states ADD COLUMN verdict TEXT')
    await db.execute('ALTER TABLE homework ADD COLUMN comment TEXT')
  },
}
