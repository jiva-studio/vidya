import { Injectable } from '@nestjs/common'
import * as domain from '@vidya/domain'
import {
  PullRequest,
  PullResponse,
  SYNC_DEFAULT_PULL_LIMIT,
  SYNC_MAX_PULL_LIMIT,
  SYNC_MAX_SCOPES,
  SyncChange,
  SyncCursors,
} from '@vidya/protocol'
import { DataSource } from 'typeorm'

import { SyncRequestException } from '../errors'
import { SyncChecksumsService } from './checksums.service'
import { SyncScopesService } from './scopes.service'

/** A journal row as the driver hands it back — snake_case, read with plain SQL. */
interface JournalRow {
  global_seq: string
  collection: string
  doc_id: string
  op: string
  data: domain.SyncPayload | null
  hlc: string
  scope_kind: string
  scope_id: string
  school_id: string
  device_id: string | null
  created_at: Date
}

/** Where one scope is being read from. */
interface ReadPosition {
  scope: domain.SyncScopeRef
  cursor: number
}

const clamp = (limit: number | undefined): number =>
  Math.min(limit ?? SYNC_DEFAULT_PULL_LIMIT, SYNC_MAX_PULL_LIMIT)

const toChange = (row: JournalRow): SyncChange => ({
  serverSeq: Number(row.global_seq),
  collection: row.collection as domain.SyncCollection,
  docId: row.doc_id,
  op: row.op as domain.SyncOp,
  data: row.data,
  hlc: row.hlc,
  scope: { kind: row.scope_kind as domain.SyncScopeKind, id: row.scope_id },
  schoolId: domain.asId<domain.SchoolId>(row.school_id),
  createdAt: domain.toIsoDateTime(row.created_at),
})

/**
 * A page of the journal, for one caller.
 *
 * The read position is a map, not a number: every scope is followed
 * separately, so a course a student was enrolled on yesterday is simply a scope
 * standing at `0` and its history arrives through this same endpoint. That is
 * why there is no backfill endpoint, and why there is no race between one.
 */
@Injectable()
export class SyncPullService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly scopes: SyncScopesService,
    private readonly checksums: SyncChecksumsService,
  ) {}

  async pull(userId: domain.UserId, request: PullRequest): Promise<PullResponse> {
    const asked = this.positionsAsked(request.cursors)
    const grants = await this.scopes.grantsFor(userId)

    // Rights first, rows second: a scope the caller has no claim to is dropped
    // here even though it was asked for by name.
    const positions = grants.map((grant) => ({
      scope: grant.scope,
      cursor: asked.get(domain.syncScopeKey(grant.scope)) ?? 0,
    }))

    const limit = clamp(request.limit)
    const found = await this.read(positions, limit)

    // What this page covered, and what of it the caller is handed. The two
    // differ by the echo filter alone, and the cursor follows the first: see
    // `advanced`.
    const scanned = found.slice(0, limit)
    const changes = scanned.filter((row) => row.device_id !== request.deviceId).map(toChange)

    return {
      changes,
      cursors: advanced(scanned),
      scopes: grants,
      checksums: await this.checksums.checksumsFor(grants.map((grant) => grant.scope)),
      hasMore: found.length > limit,
    }
  }

  /**
   * The positions the client sent, checked before anything is read.
   *
   * A ceiling on the number of scopes is a refusal with a reason rather than a
   * silently truncated list: the positions travel in the body and grow
   * with the number of courses a student takes, and a page quietly missing a
   * course is a bug nobody can see.
   */
  private positionsAsked(cursors: SyncCursors): Map<string, number> {
    const entries = Object.entries(cursors ?? {})

    if (entries.length > SYNC_MAX_SCOPES) {
      throw new SyncRequestException(
        'tooManyScopes',
        `at most ${SYNC_MAX_SCOPES} scopes per request`,
      )
    }

    return new Map(entries.map(([key, value]) => [parse(key), position(value)]))
  }

  /**
   * One indexed read per scope, merged and ordered by the journal's own
   * sequence, plus one row to answer `hasMore` without a second query.
   *
   * The calling device's own rows are read too, and dropped afterwards rather
   * than in SQL. They are not handed back — the device already has the change,
   * and echoing it would have it apply its own write on top of whatever it has
   * done since — but the page has to know they went by, or the cursor cannot be
   * told where the page ended.
   */
  private async read(positions: readonly ReadPosition[], limit: number): Promise<JournalRow[]> {
    if (positions.length === 0) return []

    const values = positions
      .map(
        (_, index) =>
          `($${index * 3 + 1}::text, $${index * 3 + 2}::uuid, $${index * 3 + 3}::bigint)`,
      )
      .join(', ')

    return this.dataSource.query(
      `WITH asked AS (
         SELECT * FROM (VALUES ${values}) AS v(scope_kind, scope_id, cursor)
       )
       SELECT j.global_seq, j.collection, j.doc_id, j.op, j.data, j.hlc,
              j.scope_kind, j.scope_id, j.school_id, j.device_id, j.created_at
         FROM sync_journal j
         JOIN asked a ON a.scope_kind = j.scope_kind AND a.scope_id = j.scope_id
        WHERE j.global_seq > a.cursor
        ORDER BY j.global_seq
        LIMIT ${limit + 1}`,
      positions.flatMap((position) => [
        position.scope.kind,
        position.scope.id,
        String(position.cursor),
      ]),
    )
  }
}

/**
 * The position each scope reached on this page — and no entry for the rest.
 *
 * It counts every row the page *read*, not every row it hands back, and the
 * difference matters. A device's own rows are filtered out of the answer, and
 * their `serverSeq` is reported nowhere else — `PushResult` names the stamp,
 * not the sequence. Advancing by the returned rows would leave the cursor stuck
 * below `headSeq` whenever a scope's tail is the caller's own work: "behind"
 * would never clear, and `ackedSeq` would never reach rows the device
 * demonstrably holds.
 *
 * The two filters are not alike and are not treated alike. A scope the caller
 * has no claim to is never read at all — `pull` intersects the asked positions
 * with the caller's grants before the first row — so no rights-filtered row can
 * appear here and no cursor is returned for such a scope. Echo is a filter on
 * delivery; rights is a filter on existence, and a position handed back for a
 * scope the caller never saw would tell it to skip history it is entitled to.
 */
const advanced = (scanned: readonly JournalRow[]): SyncCursors => {
  const reached: Record<string, number> = {}

  for (const row of scanned) {
    const scope = { kind: row.scope_kind as domain.SyncScopeKind, id: row.scope_id }

    reached[domain.syncScopeKey(scope)] = Number(row.global_seq)
  }

  return reached
}

const parse = (key: string): string => {
  try {
    return domain.syncScopeKey(domain.parseSyncScopeKey(key))
  } catch {
    throw new SyncRequestException('invalidCursor', `${key} is not a scope key`)
  }
}

const position = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new SyncRequestException('invalidCursor', 'cursor must be a non-negative integer')
  }

  return value
}
