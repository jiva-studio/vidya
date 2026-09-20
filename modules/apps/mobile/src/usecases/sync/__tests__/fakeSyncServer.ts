import {
  hlcToString,
  type IsoDateTime,
  parseHlc,
  type ServerRejectionReason,
  SYNC_DIRECTION,
  type SyncCollection,
  type SyncOp,
  type SyncPayload,
  type SyncScopeKey,
  syncScopeKey,
  type SyncScopeRef,
} from '@vidya/domain'
import type {
  AckCursorRequest,
  PullRequest,
  PullResponse,
  PushChange,
  PushRequest,
  PushResponse,
  PushResult,
  SyncChange,
  SyncChecksums,
  SyncCursors,
} from '@vidya/protocol'
import { SYNC_CLOCK_SKEW_TOLERANCE_MS } from '@vidya/protocol'
import type { ISyncClient } from '@vidya/usecases'

/**
 * A server that behaves like one, in memory.
 *
 * A client that simply hands back canned pages proves nothing about paging,
 * cursors, echo suppression or idempotency, which is where every interesting
 * device bug lives. So this keeps an append-only
 * journal, hands out pages by scope position, suppresses the caller's own rows
 * and answers a push row by row, exactly as the contract says.
 *
 * It is a test instrument, not a second implementation of the server: it holds
 * no permissions and no validation. It does restamp, because restamping is a
 * contract term rather than a server detail — a device the instrument never
 * corrects is a device whose clock defects go unnoticed here. Where it and the server must agree, they agree through the shared wire
 * fixtures in `libs/protocol/__fixtures__/sync/`, which both drive.
 */

export interface JournalRow {
  readonly serverSeq: number
  readonly collection: SyncCollection
  readonly docId: string
  readonly op: SyncOp
  readonly data: SyncPayload | null
  readonly hlc: string
  readonly scope: SyncScopeRef
  readonly schoolId: string
  readonly createdAt: IsoDateTime

  /** Who wrote it, so a pull can leave the writer's own rows out. */
  readonly deviceId: string | null
}

export interface NewJournalRow {
  readonly collection: SyncCollection
  readonly docId: string
  readonly scope: SyncScopeRef
  readonly op?: SyncOp
  readonly data?: SyncPayload | null
  readonly hlc?: string
  readonly schoolId?: string
  readonly deviceId?: string | null
  readonly createdAt?: IsoDateTime
}

/** What the server should do instead of answering, once. */
export type Interception = () => never | Promise<never>

export class FakeSyncServer implements ISyncClient {
  readonly rows: JournalRow[] = []

  /** The scopes the caller is entitled to right now. Change it to withdraw one. */
  grants: SyncScopeRef[] = []

  /** Rows per page, small on purpose so paging is exercised by default. */
  pageSize = 50

  /** Overrides the computed checksum of a scope, to stage a divergence. */
  readonly forcedChecksums = new Map<SyncScopeKey, string>()

  /** Claims there is more even when there is not, to test the loop guard. */
  alwaysHasMore = false

  /** Runs after each page is handed out — a seam for suspending the database. */
  onPull: ((index: number) => void | Promise<void>) | null = null

  /**
   * Runs after a push has been applied but before the answer is returned — the
   * seam for "the server did the work and the answer never arrived".
   */
  onPushApplied: ((index: number) => void | Promise<void>) | null = null

  /** Every call in order — 'pull' | 'push' | 'ack' — so a test can see the sequence. */
  readonly calls: string[] = []

  /**
   * Refuses a pushed row, to stage a per-row rejection.
   *
   * Narrowed to the server's half of the set: `scopeRevoked` is settled on the
   * device with nothing sent, and a double able to answer with it is a double
   * modelling something no server does — and one day feeding the device a
   * refusal the wire cannot carry.
   */
  rejectIf: (change: PushChange) => ServerRejectionReason | null = () => null

  /**
   * The server's own wall clock, in unix milliseconds.
   *
   * A stamp sitting further ahead than {@link SYNC_CLOCK_SKEW_TOLERANCE_MS}
   * allows is restamped rather than refused: one phone whose
   * clock is a year fast would otherwise anchor the ordering of the whole
   * system in the future, because every device seeds its clock from the highest
   * HLC it has seen and an HLC's physical part never comes back down. Refusing
   * is not an option — it would mean losing the student's work.
   */
  serverNowMs = 1_789_689_600_000

  readonly pullRequests: PullRequest[] = []
  readonly pushRequests: PushRequest[] = []
  readonly ackRequests: AckCursorRequest[] = []

  /** Thrown, in order, in place of the next answers. */
  readonly pullFailures: Interception[] = []
  readonly pushFailures: Interception[] = []
  readonly ackFailures: Interception[] = []

  private seq = 0
  private clock = 0
  private reissued = 0

  /** Append a row to the journal, as the server's subscriber would. */
  journal(row: NewJournalRow): JournalRow {
    this.seq += 1
    this.clock += 1
    const appended: JournalRow = {
      serverSeq: this.seq,
      collection: row.collection,
      docId: row.docId,
      op: row.op ?? 'upsert',
      data: row.op === 'delete' ? null : (row.data ?? {}),
      hlc: row.hlc ?? serverHlc(this.clock),
      scope: row.scope,
      schoolId: row.schoolId ?? SCHOOL_ID,
      createdAt: row.createdAt ?? instant(this.clock),
      deviceId: row.deviceId ?? null,
    }

    this.rows.push(appended)
    this.grant(row.scope)
    return appended
  }

  /**
   * Append a row exactly as given, defaults and all bypassed.
   *
   * The only way to stage rows a correct server would never send, and which
   * the device still has to survive.
   */
  malformed(row: Record<string, unknown> & { scope: SyncScopeRef }): void {
    this.seq += 1
    this.clock += 1
    this.rows.push({
      serverSeq: this.seq,
      collection: 'homework',
      docId: HOMEWORK_ID,
      op: 'upsert',
      data: {},
      hlc: serverHlc(this.clock),
      schoolId: SCHOOL_ID,
      createdAt: instant(this.clock),
      deviceId: null,
      ...row,
    } as unknown as JournalRow)

    this.grant(row.scope)
  }

  /** Start granting a scope, if it is not granted already. */
  grant(scope: SyncScopeRef): void {
    if (!this.grants.some((granted) => syncScopeKey(granted) === syncScopeKey(scope))) {
      this.grants.push(scope)
    }
  }

  /** Stop granting a scope — the student was withdrawn from a course. */
  revoke(scope: SyncScopeRef): void {
    this.grants = this.grants.filter((granted) => syncScopeKey(granted) !== syncScopeKey(scope))
  }

  async pull(request: PullRequest): Promise<PullResponse> {
    this.pullRequests.push(request)
    this.calls.push('pull')
    await intercept(this.pullFailures)
    if (this.onPull !== null) await this.onPull(this.pullRequests.length - 1)

    const due = this.rows
      .filter((row) => this.isGranted(row.scope))
      .filter((row) => row.deviceId !== request.deviceId)
      .filter((row) => row.serverSeq > (request.cursors[syncScopeKey(row.scope)] ?? 0))
      .sort((left, right) => left.serverSeq - right.serverSeq)

    const limit = Math.min(request.limit ?? this.pageSize, this.pageSize)
    const page = due.slice(0, limit)

    return {
      changes: page.map(toChange),
      cursors: cursorsOf(page),
      scopes: this.grants.map((scope) => ({ scope, headSeq: this.headSeq(scope) })),
      checksums: this.checksums(),
      hasMore: this.alwaysHasMore || due.length > page.length,
    }
  }

  async push(request: PushRequest): Promise<PushResponse> {
    this.pushRequests.push(request)
    this.calls.push('push')
    await intercept(this.pushFailures)

    const results = request.changes.map((change) => this.apply(change, request.deviceId))
    if (this.onPushApplied !== null) await this.onPushApplied(this.pushRequests.length - 1)

    return { results, journaledOutboxId: highestOutboxId(request.changes) }
  }

  async ackCursor(request: AckCursorRequest): Promise<void> {
    this.ackRequests.push(request)
    this.calls.push('ack')
    await intercept(this.ackFailures)
  }

  /** The scope a pushed row of `collection` is addressed to. */
  scopeFor: (collection: SyncCollection, docId: string) => SyncScopeRef = () => USER_SCOPE

  /**
   * Apply one pushed row.
   *
   * Idempotent on `(collection, docId, hlc)` *and the body*, which is what
   * makes a push replayed after a dropped connection free: a repeat finds its
   * row already journaled and is accepted without a second one being written.
   * The body is half the key on purpose — the same stamp carrying different
   * text is two devices sharing a device id, not a repeat, and it is restamped
   * rather than swallowed. A downward-only collection is refused, and the
   * refusal leaves its neighbours applied.
   */
  private apply(change: PushChange, deviceId: string): PushResult {
    const answer = {
      outboxId: change.outboxId,
      collection: change.collection,
      docId: change.docId,
    }

    if (SYNC_DIRECTION[change.collection] === 'down') {
      return { ...answer, status: 'rejected', reason: 'readOnlyCollection' }
    }

    const refusal = this.rejectIf(change)
    if (refusal !== null) return { ...answer, status: 'rejected', reason: refusal }

    const docId = this.locate(change)
    const named = { ...answer, ...(docId === change.docId ? {} : { serverDocId: docId }) }

    const existing = this.rows.find(
      (row) =>
        row.collection === change.collection && row.docId === docId && row.hlc === change.hlc,
    )

    // Same stamp, same body: a genuine repeat, and free.
    if (existing !== undefined && sameBody(existing.data, change.data)) {
      return { ...named, status: 'accepted', serverHlc: existing.hlc, restamped: false }
    }

    // Same stamp, a *different* body — what two handsets restored from one
    // backup produce, because they share a device id and so issue the same
    // stamps. Keeping the idempotency key here would swallow the second write
    // as an imagined repeat, which is a lost answer reported as a saved one, so
    // the contract restamps and keeps both records.
    const stamped = existing === undefined ? this.restamp(change.hlc) : this.nextServerStamp()
    this.journal({
      collection: change.collection,
      docId,
      scope: this.scopeFor(change.collection, docId),
      op: change.op,
      data: change.data,
      hlc: stamped,
      deviceId,
    })

    return {
      ...named,
      status: 'accepted',
      serverHlc: stamped,
      restamped: stamped !== change.hlc,
    }
  }

  /**
   * The id this row is written under: the one it was sent with, or the one the
   * natural key already holds.
   *
   * A device names the rows it writes offline, so two devices of one student
   * hand in the same section under two ids. The server's tables are keyed
   * naturally, so the second push lands on the row the first created and the
   * answer says so with `serverDocId`.
   */
  private locate(change: PushChange): string {
    const known = this.rows.some(
      (row) => row.collection === change.collection && row.docId === change.docId,
    )
    const key = NATURAL_KEYS[change.collection]
    if (known || key === undefined || change.data === null) return change.docId

    const natural = this.rows.find(
      (row) =>
        row.collection === change.collection &&
        row.data !== null &&
        key.every((field) => row.data![field] === change.data![field]),
    )

    return natural?.docId ?? change.docId
  }

  /** Pull a stamp from too far in the future back to the server's own clock. */
  private restamp(hlc: string): string {
    const ceiling = this.serverNowMs + SYNC_CLOCK_SKEW_TOLERANCE_MS
    if (parseHlc(hlc).physical <= ceiling) return hlc

    return this.nextServerStamp()
  }

  /** A stamp of the server's own, distinct from every one it has issued before. */
  private nextServerStamp(): string {
    this.reissued += 1
    return hlcToString({
      physical: this.serverNowMs,
      counter: this.reissued,
      deviceId: 'server',
    })
  }

  private isGranted(scope: SyncScopeRef): boolean {
    return this.grants.some((granted) => syncScopeKey(granted) === syncScopeKey(scope))
  }

  private headSeq(scope: SyncScopeRef): number {
    return this.rows
      .filter((row) => syncScopeKey(row.scope) === syncScopeKey(scope))
      .reduce((max, row) => Math.max(max, row.serverSeq), 0)
  }

  /**
   * A summary of each scope's content.
   *
   * Over the live payloads rather than the row count, so it changes when the
   * content changes and only then — which is the property names and the
   * one a device relies on to notice it is missing something.
   */
  private checksums(): SyncChecksums {
    const checksums: Record<string, string> = {}

    for (const scope of this.grants) {
      const key = syncScopeKey(scope)
      const forced = this.forcedChecksums.get(key)
      const rows = this.rows.filter((row) => syncScopeKey(row.scope) === key)
      checksums[key] = forced ?? fingerprint(rows.map(toChange))
    }

    return checksums as SyncChecksums
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

export const SCHOOL_ID = '5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915'
export const USER_SCOPE: SyncScopeRef = { kind: 'user', id: '7b3d5e90-1c44-4a2b-8f61-2d9e0c4a5b73' }
export const COURSE_SCOPE: SyncScopeRef = {
  kind: 'course',
  id: '2f9a1c58-6d21-4f0e-9a44-0b7c1e5d3a10',
}

export const OTHER_COURSE_SCOPE: SyncScopeRef = {
  kind: 'course',
  id: 'b6d40e27-8c31-4a95-b7f2-0e5a1d38c624',
}

/** Fixed identifiers, so a test can name the same document twice. */
export const COURSE_ID = COURSE_SCOPE.id
export const LESSON_ID = 'c92b48e1-0f77-4d35-a8b2-6e1d3c05f482'
export const LESSON_VERSION_ID = 'a41c7d02-33b5-4e8f-9c6a-71e204f5d8b3'
export const ENROLLMENT_ID = '3a5c7e92-4b18-4d06-9f2e-1c8b6d4a3f57'
export const HOMEWORK_ID = 'd7e93f41-5a0c-4b62-8e17-9c3d5f2a1b48'
export const SECTION_ID = 'b18f4c60-27d9-4e51-a3c8-5f0b9e2d7614'
export const BLOCK_STATE_ID = '4e8a1c93-7b25-4f60-8d31-2a9c5e0b7f43'
export const BLOCK_ID = '9c1d2e34-5a67-4b89-8c01-2d3e4f5a6b70'
export const STUDENT_ID = '7b3d5e90-1c44-4a2b-8f61-2d9e0c4a5b73'

/**
 * What addresses a row besides its id, per collection.
 *
 * The same keys the server's tables are unique on. A collection absent from
 * here is addressed by its id alone.
 */
const NATURAL_KEYS: Partial<Record<SyncCollection, readonly string[]>> = {
  homework: ['enrollmentId', 'lessonVersionId', 'sectionId'],
  block_states: ['enrollmentId', 'lessonVersionId', 'blockId'],
  enrollments: ['courseId', 'studentId'],
}

/** A server-issued stamp, one millisecond apart per row so ordering is plain. */
export const serverHlc = (tick: number): string =>
  `${String(1_789_689_600_000 + tick).padStart(15, '0')}:00000:server`

/** The matching instant, UTC and millisecond-precise. */
export const instant = (tick: number): IsoDateTime =>
  new Date(1_789_689_600_000 + tick).toISOString() as IsoDateTime

/** Whether the journal already holds exactly what was sent under this stamp. */
const sameBody = (stored: SyncPayload | null, sent: SyncPayload | null): boolean =>
  JSON.stringify(stored ?? null) === JSON.stringify(sent ?? null)

async function intercept(queue: Interception[]): Promise<void> {
  const next = queue.shift()
  if (next !== undefined) await next()
}

const toChange = (row: JournalRow): SyncChange => ({
  serverSeq: row.serverSeq,
  collection: row.collection,
  docId: row.docId,
  op: row.op,
  data: row.data,
  hlc: row.hlc,
  scope: row.scope,
  schoolId: row.schoolId as SyncChange['schoolId'],
  createdAt: row.createdAt,
})

function cursorsOf(page: readonly JournalRow[]): SyncCursors {
  const cursors: Record<string, number> = {}
  for (const row of page) {
    const key = syncScopeKey(row.scope)
    cursors[key] = Math.max(cursors[key] ?? 0, row.serverSeq)
  }

  return cursors as SyncCursors
}

const highestOutboxId = (changes: readonly PushChange[]): number =>
  changes.reduce((max, change) => Math.max(max, change.outboxId), 0)

/** A cheap, stable digest — enough to tell "the same" from "different". */
function fingerprint(changes: readonly SyncChange[]): string {
  const text = JSON.stringify(
    changes.map((change) => [change.collection, change.docId, change.op, change.data]),
  )

  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return hash.toString(16).padStart(8, '0')
}
