import initSqlJs, { type Database } from 'sql.js'

import type { CapacitorConnection } from '../capacitor/capacitorSqlDatabase'

/**
 * A stand-in for the plugin's `SQLiteDBConnection`, backed by real SQLite.
 *
 * The Capacitor adapter had never been executed — not in the app, not in one
 * test — because everything runs on sql.js. This double closes that gap on CI:
 * the adapter's own logic (its transaction queue, its recovery, its suspend)
 * runs against real SQL, with the plugin's interface in front of it rather than
 * sql.js's.
 *
 * It is not a simulator of the plugin and does not pretend to be one. It
 * reproduces the two behaviours the adapter actually depends on and that sql.js
 * cannot show:
 *
 * - `beginTransaction` refuses while a transaction is open, the way SQLite
 *   does — "cannot start a transaction within a transaction";
 * - a rollback can fail and leave the transaction open, which on a device is
 *   what turns one failed write into a database that refuses every later block
 *   until the app restarts.
 *
 * What only the device can prove — that the plugin parses our DDL, that the
 * native side honours `busy_timeout` — is why the conformance suite is written
 * to be pointed at a real connection too.
 */
export interface ConnectionFaults {
  /**
   * `rollbackTransaction` throws, and the transaction stays open — a device
   * failure sql.js rolls back in memory and never reports.
   */
  failRollback?: boolean
}

export interface ConnectionDouble {
  readonly connection: CapacitorConnection

  /** Faults to inject. Mutated between statements by a test. */
  readonly faults: ConnectionFaults

  /** Whether a transaction is open, as the connection sees it. */
  isActive(): boolean
}

const NO_CHANGES = { changes: { changes: 0 } }

/**
 * Wraps `db` in the plugin's interface.
 *
 * The sql.js database is not closed by anything here, so reopening the same
 * double is a relaunch against the same bytes — a file, in the way that
 * matters.
 */
export function wrapAsCapacitorConnection(db: Database): ConnectionDouble {
  const faults: ConnectionFaults = {}
  let active = false

  const connection: CapacitorConnection = {
    async query(statement: string, values?: unknown[]) {
      const stmt = db.prepare(statement)
      if (values?.length) stmt.bind(values as never)

      const rows: unknown[] = []
      while (stmt.step()) rows.push(stmt.getAsObject())
      stmt.free()

      return { values: rows }
    },

    async run(statement: string, values?: unknown[]) {
      db.run(statement, (values ?? []) as never)
      return NO_CHANGES
    },

    async beginTransaction() {
      // SQLite's own refusal, which is the whole reason the adapter serialises
      // blocks and recovers from a rollback it could not perform.
      if (active) throw new Error('cannot start a transaction within a transaction')

      db.run('BEGIN')
      active = true
      return NO_CHANGES
    },

    async commitTransaction() {
      db.run('COMMIT')
      active = false
      return NO_CHANGES
    },

    async rollbackTransaction() {
      if (faults.failRollback === true) {
        throw new Error('rollback failed; the transaction is still open')
      }

      db.run('ROLLBACK')
      active = false
      return NO_CHANGES
    },

    async isTransactionActive() {
      return { result: active }
    },
  }

  return { connection, faults, isActive: () => active }
}

/** One in-memory SQLite database, opened the way the sql.js adapter opens one. */
export async function openSqlJsDatabase(): Promise<Database> {
  const SQL = await initSqlJs()
  return new SQL.Database()
}
