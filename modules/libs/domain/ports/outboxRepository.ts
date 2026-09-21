/**
 * The local change journal the push path drains.
 *
 * Sign-in is by OTP only, so there is no anonymous account to adopt changes
 * from and no handover to re-attribute; and rows are never deleted, so there is
 * no compaction either.
 *
 * Domain port: the SQL implementation lives with the device's infrastructure.
 * Every method joins the caller's unit of work and never opens a transaction of
 * its own — the outbox row and the domain row it describes are written
 * together, or not at all.
 */

import { IsoDateTime } from '../identity'
import { SyncCollection, SyncOp, SyncPayload, SyncRejectionReason } from '../sync/types'

/**
 * What happened to a journaled row. A row is never removed: `rejected` is a
 * state it keeps, so the reason stays next to the work it belongs to and the
 * student's answer stays on the device.
 */
export const OutboxStatuses = ['pending', 'pushed', 'rejected'] as const
export type OutboxStatus = (typeof OutboxStatuses)[number]

/** A journaled local change, in the already-deserialized shape. */
export interface OutboxEntry {
  /** Autoincrement rowid — the local push order and the push watermark. */
  readonly id: number

  readonly collection: SyncCollection
  readonly docId: string
  readonly op: SyncOp

  /** The row snapshot to send; `null` on a delete tombstone. */
  readonly data: SyncPayload | null

  /** HLC stamped on this change, in the same transaction as the domain write. */
  readonly hlc: string

  /** Last server HLC this change derived from; `null` when the doc is new here. */
  readonly baseHlc: string | null

  /** The identity that wrote the row — never the identity that happens to be signed in now. */
  readonly ownerId: string

  readonly status: OutboxStatus

  /** Set only on `rejected`, and kept for as long as the row lives. */
  readonly reason: SyncRejectionReason | null

  /** When the row was journaled. UTC, always. */
  readonly createdAt: IsoDateTime
}

/** A row to append. `id`, `status` and `createdAt` are the adapter's to assign. */
export interface NewOutboxEntry {
  readonly collection: SyncCollection
  readonly docId: string
  readonly op: SyncOp
  readonly data: SyncPayload | null
  readonly hlc: string
  readonly baseHlc: string | null

  /**
   * Whose change this is. Passed explicitly rather than read from the session,
   * because a row must stay with the identity that wrote it even if the device
   * changes hands before the row is sent.
   */
  readonly ownerId: string
}

/** Which pending rows a push may read. */
export interface OutboxScope {
  /** The identity draining the journal. Rows of any other owner stay put. */
  readonly ownerId: string

  /**
   * The watermark (`sync_state.pushed_outbox_id`, `0` when the device has never
   * pushed). Rows at or below it are retired — pushed, or rejected and stepped
   * over — and are never sent again.
   */
  readonly afterId?: number
}

/** How the server answered one row, as recorded back onto it. */
export interface OutboxAcknowledgement {
  readonly id: number
  readonly status: Extract<OutboxStatus, 'pushed' | 'rejected'>

  /** Present exactly when `status` is `rejected`. */
  readonly reason?: SyncRejectionReason
}

/** A document renamed to the id the server wrote it under. */
export interface OutboxDocRename {
  readonly ownerId: string
  readonly collection: SyncCollection
  readonly docId: string
  readonly serverDocId: string
}

export interface IOutboxRepository {
  /**
   * Pending rows in insertion order, oldest first, narrowed to the owner and
   * the watermark. Order is the contract: two offline edits of one document
   * must reach the server in the order they were made, or the first one wins.
   */
  listPending(scope: OutboxScope, limit?: number): Promise<readonly OutboxEntry[]>

  /**
   * Rows whose work is still owed to the server: the ones waiting to be sent.
   *
   * The merge asks *this* list whether it may take a document whole, so a row
   * belongs here only while a later push could still deliver it. A refused row
   * cannot: the watermark has stepped over it and nothing will send it again.
   * Counting it as unsettled would lay the undelivered text over every page the
   * server sends, for as long as the document exists. Those rows are
   * {@link listDead}'s, and a screen reads them from there.
   *
   * Not narrowed by the watermark: a pending row below it is one a push is
   * carrying right now, and its work is still only on this device.
   */
  listUnsettled(scope: OutboxScope): Promise<readonly OutboxEntry[]>

  /**
   * Rows that are finished and were never taken — refused, and never to be
   * sent again.
   *
   * The counterpart to {@link listUnsettled}, and disjoint from it. The work
   * they carry is owed to nobody but the student, who is still owed the sight
   * of it: without this reading a refused document has no row anywhere and a
   * screen paints it as accepted.
   */
  listDead(scope: OutboxScope): Promise<readonly OutboxEntry[]>

  /** Append a journaled change. Called by the journal decorator, in its transaction. */
  append(entry: NewOutboxEntry): Promise<void>

  /**
   * Record the server's per-row answer. Idempotent: replaying an answer after a
   * dropped connection changes nothing. It never deletes a row — an accepted
   * row is marked `pushed`, a refused one keeps its reason.
   */
  acknowledge(results: readonly OutboxAcknowledgement[]): Promise<void>

  /**
   * Point every journaled row of a document at the id the server wrote it
   * under, so the next edit is sent under the name the server knows rather
   * than under one only this device ever used.
   */
  renameDoc(rename: OutboxDocRename): Promise<void>

  /**
   * The highest HLC ever journaled by this owner, or `null` on an empty
   * journal. Seeds the next stamp so a restart cannot issue an HLC below one
   * already sent.
   */
  latestHlc(ownerId: string): Promise<string | null>

  /**
   * The highest HLC ever journaled on this installation, whoever wrote it.
   *
   * The HLC is the **device's** clock, not an identity's: one `device_id` sits
   * in every stamp this installation issues, and the counter that makes two
   * stamps of the same millisecond distinct is counted per device. Seeding that
   * counter from one identity's rows restarts it when the handset changes
   * hands, and the next student's first write is then stamped with an HLC the
   * previous one already used — two different writes under one idempotency key
   * Hence: every row, every owner, one seat.
   */
  latestHlcOnDevice(): Promise<string | null>

  /**
   * The highest `id` ever journaled, `0` when the journal is empty. The push
   * watermark is moved to it, so the rows already answered for are stepped
   * over without being removed.
   */
  latestId(ownerId: string): Promise<number>
}
