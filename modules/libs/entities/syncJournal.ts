import { SchoolId, UserId } from '@vidya/domain'
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

/** What happened to the document. A delete carries no body, only the tombstone. */
export type SyncOp = 'upsert' | 'delete'

/**
 * Who a journal row is addressed to.
 *
 * The addressee is a property of the row, stamped when it is written, not a
 * permission recomputed on every pull. That is what keeps a pull free of joins
 * and keeps one tenant's rows physically out of another's page.
 */
export type SyncScopeKind = 'school' | 'course' | 'user'

/**
 * One synchronised change, as devices will read it.
 *
 * `globalSeq` is the cursor. It is a `bigint` in Postgres and therefore a string
 * here: the driver refuses to narrow it to a JS number, and rightly so.
 *
 * The row is written by exactly one writer — the sync journal subscriber — so
 * that a change cannot be journalled twice or forgotten once. See
 * `services/api/src/sync/journal`.
 */
@Entity({ name: 'sync_journal' })
export class SyncJournal {
  @PrimaryGeneratedColumn({ name: 'global_seq', type: 'bigint' })
  globalSeq: string

  @Column({ name: 'collection', type: 'text', nullable: false })
  collection: string

  @Column({ name: 'doc_id', type: 'uuid', nullable: false })
  docId: string

  @Column({ name: 'op', type: 'text', nullable: false })
  op: SyncOp

  /** The wire projection of the document, or `null` when the row is a tombstone. */
  @Column({ name: 'data', type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null

  /** Hybrid logical clock, zero-padded so text order is causal order. */
  @Column({ name: 'hlc', type: 'text', nullable: false })
  hlc: string

  @Column({ name: 'scope_kind', type: 'text', nullable: false })
  scopeKind: SyncScopeKind

  @Column({ name: 'scope_id', type: 'uuid', nullable: false })
  scopeId: string

  @Column({ name: 'school_id', type: 'uuid', nullable: false })
  schoolId: SchoolId

  /** `null` when the write arrived over REST rather than through sync. */
  @Column({ name: 'device_id', type: 'text', nullable: true })
  deviceId: string | null

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: UserId | null

  /** UTC, always. Local time never reaches this table. */
  @Column({ name: 'created_at', type: 'timestamptz', nullable: false, default: () => 'now()' })
  createdAt: Date
}
