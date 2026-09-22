import type { OutboxEntry, OutboxScope, SyncPayload } from '@vidya/domain'
import type { ISyncClient, RetryPolicyOptions, TokenRefresher } from '@vidya/usecases'

import type { UtcClock } from '../../../infra/persistence'
import { openTestDatabase } from '../../../infra/persistence/testing'
import type { IDatabase } from '../../../ports'
import { createSyncEngine, type SyncEngine } from '../engine'
import { FakeSyncServer } from './fakeSyncServer'

/**
 * One line to get a migrated SQLite database, the real adapters, the real
 * scenarios, and a server that behaves like one.
 *
 * Every test here runs against actual SQLite through `sql.js` — no device, no
 * emulator, no mocked repository. The engine's failures are transaction
 * failures, ordering failures and cursor failures, and none of them reproduce
 * against a fake repository that cannot roll back.
 *
 * Clock and randomness are pinned and advanced by hand, because HLC ordering
 * and retry jitter are precisely what is under test.
 */

export const OWNER = 'owner-a'
export const OTHER_OWNER = 'owner-b'
export const DEVICE = 'device-a'

export interface HarnessOptions {
  readonly ownerId?: string
  readonly deviceId?: string
  readonly server?: FakeSyncServer

  /**
   * The transport the engine talks to, when it must not be the fake server
   * itself. Wrap {@link server} to stage an answer the server would never
   * compose — a grant list that arrived empty, a cursor map naming a position
   * no row in the page reaches — while still staging the journal through it.
   */
  readonly client?: ISyncClient

  readonly refreshToken?: TokenRefresher
  readonly retry?: RetryPolicyOptions
  readonly pullLimit?: number

  /** Reuse an open database, to put a second identity on one installation. */
  readonly db?: IDatabase
}

export interface Harness {
  readonly db: IDatabase
  readonly server: FakeSyncServer
  readonly engine: SyncEngine

  /** Whose run it is. Reassign to model the device changing hands. */
  ownerId: string

  /** Unix milliseconds handed to the HLC. Advance it to order writes. */
  nowMs: number

  /** Next value the jitter will draw. */
  roll: number

  /** Every outbox row of every identity, in insertion order. */
  allOutboxRows(): Promise<OutboxRowShape[]>

  outboxOf(owner: string): Promise<OutboxRowShape[]>

  /** One row of a synced table, as stored. */
  row(table: string, id: string, owner?: string): Promise<SyncPayload | null>

  count(table: string): Promise<number>
}

/** The outbox as a test reads it: the port's entry plus what the port hides. */
export type OutboxRowShape = OutboxEntry

/**
 * The second reading the journal owes a screen: rows it is finished with that
 * the server never took.
 *
 * Declared here rather than imported, because the port does not carry it yet —
 * and a test that cannot name the reading cannot state what is missing.
 */
export interface DeadLetterJournal {
  listDead(scope: OutboxScope): Promise<readonly OutboxEntry[]>
}

export const deadRows = (
  harness: Harness,
  ownerId: string = OWNER,
): Promise<readonly OutboxEntry[]> =>
  (harness.engine.outbox as unknown as DeadLetterJournal).listDead({ ownerId })

export async function openHarness(options: HarnessOptions = {}): Promise<Harness> {
  const db = options.db ?? (await openTestDatabase()).db
  const server = options.server ?? new FakeSyncServer()

  const harness: Harness = {
    db,
    server,
    ownerId: options.ownerId ?? OWNER,
    nowMs: 1_789_689_600_000,
    roll: 0.5,
    engine: undefined as unknown as SyncEngine,
    allOutboxRows: () => readOutbox(db, null),
    outboxOf: (owner) => readOutbox(db, owner),
    row: (table, id, owner) => readRow(db, table, id, owner ?? harness.ownerId),
    count: (table) => countRows(db, table),
  }

  const now: UtcClock = () => new Date(harness.nowMs).toISOString() as ReturnType<UtcClock>

  Object.assign(harness, {
    engine: createSyncEngine({
      db,
      client: options.client ?? server,
      deviceId: async () => options.deviceId ?? DEVICE,
      ownerId: () => harness.ownerId,
      now,
      nowMs: () => harness.nowMs,
      random: () => harness.roll,
      refreshToken: options.refreshToken,
      retry: options.retry,
      pullOptions: options.pullLimit === undefined ? undefined : { limit: options.pullLimit },
    }),
  })

  return harness
}

/* -------------------------------------------------------------------------- */
/*                              Reading the tables                            */
/* -------------------------------------------------------------------------- */

interface RawOutboxRow {
  id: number
  collection: string
  doc_id: string
  op: string
  data: string | null
  hlc: string
  base_hlc: string | null
  owner_id: string
  status: string
  reason: string | null
  created_at: string
}

/**
 * Reads the outbox directly rather than through the repository, on purpose.
 *
 * The watchdog test has to be able to see rows the repository would
 * filter out — a row this identity does not own, a row already answered for —
 * because "no row was ever deleted" is a claim about the table, not about the
 * view of it the engine happens to take.
 */
async function readOutbox(db: IDatabase, owner: string | null): Promise<OutboxRowShape[]> {
  const rows =
    owner === null
      ? await db.query<RawOutboxRow>('SELECT * FROM outbox ORDER BY id ASC')
      : await db.query<RawOutboxRow>('SELECT * FROM outbox WHERE owner_id = ? ORDER BY id ASC', [
          owner,
        ])

  return rows.map((row) => ({
    id: Number(row.id),
    collection: row.collection as OutboxEntry['collection'],
    docId: row.doc_id,
    op: row.op as OutboxEntry['op'],
    data: row.data === null ? null : (JSON.parse(row.data) as SyncPayload),
    hlc: row.hlc,
    baseHlc: row.base_hlc,
    ownerId: row.owner_id,
    status: row.status as OutboxEntry['status'],
    reason: row.reason as OutboxEntry['reason'],
    createdAt: row.created_at as OutboxEntry['createdAt'],
  }))
}

async function readRow(
  db: IDatabase,
  table: string,
  id: string,
  owner: string,
): Promise<SyncPayload | null> {
  const rows = await db.query<SyncPayload>(`SELECT * FROM ${table} WHERE owner_id = ? AND id = ?`, [
    owner,
    id,
  ])

  return rows[0] ?? null
}

/**
 * A database that refuses one statement, to stage a crash mid-transaction.
 *
 * The only honest way to test that a domain row and its outbox row are written
 * together: make the second write fail and check that the first one is
 * gone too. A repository fake cannot show this, because a fake has no
 * transaction to roll back.
 */
export function failingDatabase(db: IDatabase, shouldFail: (sql: string) => boolean): IDatabase {
  return {
    query: (sql, params) => db.query(sql, params),
    execute: async (sql, params) => {
      if (shouldFail(sql)) throw new Error(`staged failure on: ${sql.slice(0, 40)}`)
      await db.execute(sql, params)
    },
    transaction: (fn) => db.transaction(fn),
    save: () => db.save(),
    suspend: () => db.suspend(),
    resume: () => db.resume(),
    close: () => db.close(),
  }
}

async function countRows(db: IDatabase, table: string): Promise<number> {
  const rows = await db.query<{ total: number }>(`SELECT COUNT(*) AS total FROM ${table}`)
  return Number(rows[0]?.total ?? 0)
}
