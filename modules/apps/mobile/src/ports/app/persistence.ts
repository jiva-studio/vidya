/**
 * The local SQL database the app is allowed to know about.
 *
 * Shape lifted from `kit/src/persistence/database.ts` in lectorium. The port
 * is written out here rather than imported: a port belongs to the application
 * that declares it, and importing another codebase's port is exactly the
 * coupling the hexagon exists to prevent.
 *
 * Two adapters implement it — `@capacitor-community/sqlite` on the device and
 * `sql.js` in tests — and nothing above this file mentions either.
 */

/** A value SQLite can bind to a statement parameter. */
export type QueryValue = number | string | Uint8Array | null

export type QueryParams = QueryValue[]

/** A single row of a SQL result. Use `unknown` when the caller owns the shape. */
export type Row = Record<string, unknown>

/** Connection to an opened SQL database. */
export interface IDatabase {
  /** Execute a read query; returns result rows. */
  query<T = unknown>(query: string, params?: QueryParams): Promise<T[]>

  /** Execute a write statement. */
  execute(statement: string, params?: QueryParams): Promise<void>

  /**
   * Run statements inside a transaction. Rolled back on throw.
   *
   * A block must cover one unit of work and nothing more — one migration, one
   * page of a sync pull, one domain write with its outbox row. It must never
   * span a network call or a whole sync run: see {@link IDatabase.suspend} for
   * why that is a crash and not merely a slow query.
   */
  transaction(fn: () => Promise<void>): Promise<void>

  /** Flush pending writes to underlying storage. */
  save(): Promise<void>

  /**
   * Refuse new transactions, let the in-flight one settle, and release the
   * SQLite lock.
   *
   * iOS kills an app that is still holding a SQLite lock when it is suspended
   * — `0xdead10cc` — and that death happens on a student's phone, never in our
   * logs. The composition root wires this to `pause` from `@capacitor/app`.
   *
   * It is safe to call on an idle database, and safe to call twice. While
   * suspended, {@link IDatabase.transaction} rejects with
   * {@link DatabaseSuspendedError} instead of taking a lock the system is
   * about to punish us for; reads and single statements still work, because
   * they hold no lock across an await.
   *
   * Resuming is free precisely because the work above it is resumable: sync
   * positions are already durable, so an interrupted run restarts from where
   * it stopped rather than from the beginning.
   */
  suspend(): Promise<void>

  /** Accept transactions again after a {@link IDatabase.suspend}. */
  resume(): void

  /** Close the connection. */
  close(): Promise<void>
}

/**
 * Thrown when a transaction is requested on a suspended database.
 *
 * Callers are expected to treat it as "not now, try after resume", not as a
 * data failure: nothing was written and nothing was lost.
 */
export class DatabaseSuspendedError extends Error {
  constructor() {
    super('the database is suspended and is not taking transactions')
    this.name = 'DatabaseSuspendedError'
  }
}

/** Factory for opening databases. */
export interface IPersistence {
  /** Open (creating if needed) the database at `dbName`. */
  open(dbName: string): Promise<IDatabase>
}
