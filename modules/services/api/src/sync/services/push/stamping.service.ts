import { Inject, Injectable } from '@nestjs/common'
import * as domain from '@vidya/domain'
import { PushChange, SYNC_CLOCK_SKEW_TOLERANCE_MS } from '@vidya/protocol'
import { EntityManager } from 'typeorm'

import { CLOCK, Clock, ServerHlcService } from '../../journal'

/** The stamp a row will be journalled under, and how it was arrived at. */
export interface Stamp {
  hlc: string

  /** The server assigned the stamp rather than keeping the one that was sent. */
  restamped: boolean

  /** The journal already holds this exact row: nothing needs writing at all. */
  repeat: boolean
}

/** Compares what the client sent against what the journal stored, field by field. */
const sameBody = (stored: domain.SyncPayload | null, sent: domain.SyncPayload): boolean => {
  if (!stored) return false

  return Object.entries(sent).every(([field, value]) => equal(stored[field], value))
}

const equal = (stored: unknown, sent: unknown): boolean => {
  if (stored === sent) return true

  // An instant survives the journal as an ISO string and comes back as one; the
  // client may have sent a different rendering of the same moment.
  if (isInstant(stored) && isInstant(sent)) {
    return Date.parse(String(stored)) === Date.parse(String(sent))
  }

  return JSON.stringify(stored ?? null) === JSON.stringify(sent ?? null)
}

const isInstant = (value: unknown): boolean =>
  typeof value === 'string' && value.length >= 20 && !Number.isNaN(Date.parse(value))

/**
 * Which HLC a pushed row is stored under.
 *
 * Two different accidents lead to the same cure, and a refusal is not available
 * for either of them — refusing here would mean losing work a student has
 * already done, which the plan does not allow under any circumstances.
 *
 * - **A device whose clock is fast.** Its stamps would otherwise be
 *   adopted by every other device, because each seeds its clock from the highest
 *   stamp it has seen and an HLC's physical part never comes back down. One
 *   broken phone would anchor the ordering of the whole system in the future.
 * - **Two devices sharing a `deviceId`.** A phone restored from another's
 *   backup issues the same stamps, so two *different* changes can collide on
 *   `(collection, doc_id, hlc)` and the idempotency index would swallow the
 *   second as an imagined repeat — a lost write dressed as a successful one.
 *
 * So the body decides: the same stamp with the same body is a genuine repeat and
 * is answered with the stamp already stored; the same stamp with a different
 * body is restamped, and both records survive.
 */
@Injectable()
export class SyncStampingService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly serverHlc: ServerHlcService,
  ) {}

  async stampFor(
    manager: EntityManager,
    change: PushChange,
    body: domain.SyncPayload,
  ): Promise<Stamp> {
    if (this.tooFarAhead(change.hlc)) {
      return { hlc: await this.serverHlc.next(manager), restamped: true, repeat: false }
    }

    const stored = await this.journalled(manager, change)

    if (stored === undefined) {
      return { hlc: change.hlc, restamped: false, repeat: false }
    }

    if (sameBody(stored, body)) {
      return { hlc: change.hlc, restamped: false, repeat: true }
    }

    return { hlc: await this.serverHlc.next(manager), restamped: true, repeat: false }
  }

  /** `true` when the stamp sits further ahead of the server than the contract allows. */
  private tooFarAhead(hlc: string): boolean {
    return domain.parseHlc(hlc).physical > this.clock.nowMs() + SYNC_CLOCK_SKEW_TOLERANCE_MS
  }

  /** The body already journalled under this stamp, or `undefined` if there is none. */
  private async journalled(
    manager: EntityManager,
    change: PushChange,
  ): Promise<domain.SyncPayload | null | undefined> {
    const rows: { data: domain.SyncPayload | null }[] = await manager.query(
      `SELECT data FROM sync_journal
        WHERE collection = $1 AND doc_id = $2 AND hlc = $3
        LIMIT 1`,
      [change.collection, change.docId, change.hlc],
    )

    return rows.length === 0 ? undefined : rows[0].data
  }
}
