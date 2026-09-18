import { Inject, Injectable, Logger } from '@nestjs/common'
import * as domain from '@vidya/domain'
import { PushChange, PushResult, SYNC_MAX_CHANGE_BYTES } from '@vidya/protocol'
import { DataSource, EntityManager } from 'typeorm'

import { CLOCK, Clock, withSyncWriteContext } from '../../journal'
import { blockStatesApplier } from './blockStates.applier'
import { enrollmentsApplier } from './enrollments.applier'
import { homeworkApplier } from './homework.applier'
import { SyncStampingService } from './stamping.service'
import { isRejection, PushApplier, PushRowContext, reject, Rejection } from './types'

const APPLIERS: Partial<Record<domain.SyncCollection, PushApplier>> = {
  enrollments: enrollmentsApplier,
  homework: homeworkApplier,
  block_states: blockStatesApplier,
}

/**
 * Why a collection with no applier takes nothing from a device.
 *
 * What is left here is the school's content. It is written in the admin console
 * and replicates downward only, so a course arriving from a phone is a bug on
 * the phone rather than a change anyone meant to make.
 *
 * `enrollments` is deliberately not one of them, though its `status` is a field
 * the server wins on. Up goes the request, down comes the decision — that is
 * the collection's direction in the plan's "what goes where" table, and the two
 * sides are kept apart by the field split, not by a ban on the collection. A
 * device must be able to ask for a place while it is offline, which is the case
 * offline mode exists for; refusing it would leave an outbox row that is never
 * deleted and never accepted, refused for a reason the model itself denies.
 */
const READ_ONLY: Partial<Record<domain.SyncCollection, string>> = {
  courses: 'courses replicate downward only',
  lessons: 'lessons replicate downward only',
  lesson_versions: 'lesson versions replicate downward only',
}

const accepted = (change: PushChange, hlc: string, restamped: boolean): PushResult => ({
  outboxId: change.outboxId,
  collection: change.collection,
  docId: change.docId,
  status: 'accepted',
  serverHlc: hlc,
  restamped,
})

const rejected = (change: PushChange, refusal: Rejection): PushResult => ({
  outboxId: change.outboxId,
  collection: change.collection,
  docId: change.docId,
  status: 'rejected',
  reason: refusal.reason,
  detail: refusal.detail,
})

/**
 * Whether the envelope can be read at all, before a transaction is opened.
 *
 * The contract fixes the order of the checks that follow this one, and the
 * first to fire names the reason. This one comes before all of them: a row over
 * the ceiling must not be parsed, and a collection nobody may write is answered
 * without touching the database.
 */
const envelope = (change: PushChange): Rejection | null => {
  if (Buffer.byteLength(JSON.stringify(change.data ?? null)) > SYNC_MAX_CHANGE_BYTES) {
    return reject('payloadTooLarge', 'the row is over the size ceiling')
  }

  if (!domain.isSyncCollection(change.collection)) {
    return reject('malformed', `${change.collection} is not a collection`)
  }

  if (!APPLIERS[change.collection]) {
    return reject('readOnlyCollection', READ_ONLY[change.collection] ?? 'not writable by a device')
  }

  return stamp(change)
}

const stamp = (change: PushChange): Rejection | null => {
  // A tombstone is the server's to write: what a student stops doing is a state
  // of their row, not the disappearance of it.
  if (change.op !== 'upsert') {
    return reject('malformed', 'a device does not delete rows')
  }

  try {
    domain.parseHlc(change.hlc)
  } catch {
    return reject('malformed', `${change.hlc} is not an HLC`)
  }

  return null
}

/**
 * One pushed row, in a transaction of its own.
 *
 * A transaction per row is what makes AC-6 true rather than hopeful: a refusal,
 * or a constraint nobody foresaw, rolls back that row and leaves the video
 * progress travelling beside it applied.
 */
@Injectable()
export class SyncPushRowService {
  private readonly logger = new Logger(SyncPushRowService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly stamping: SyncStampingService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async apply(userId: domain.UserId, deviceId: string, change: PushChange): Promise<PushResult> {
    const refusal = envelope(change)

    if (refusal) return rejected(change, refusal)

    try {
      return await this.dataSource.transaction((manager) =>
        this.write(manager, change, { userId, now: this.clock.nowMs() }, deviceId),
      )
    } catch (error) {
      // Nothing may take the batch down with it. The row keeps its work on the
      // device and comes back on the next attempt.
      this.logger.error(`push of ${change.collection}/${change.docId} failed`, error)

      return rejected(change, reject('malformed', 'the row could not be applied'))
    }
  }

  private async write(
    manager: EntityManager,
    change: PushChange,
    context: PushRowContext,
    deviceId: string,
  ): Promise<PushResult> {
    const applier = APPLIERS[change.collection]
    const prepared = await applier.prepare(manager, change, context)

    if (isRejection(prepared)) return rejected(change, prepared)

    const stamped = await this.stamping.stampFor(manager, change, prepared.body)

    // A genuine repeat is answered from the journal: the work is already there,
    // and a resend after a dropped connection must cost nothing (D-3).
    if (stamped.repeat) return accepted(change, stamped.hlc, false)

    const frozen = await applier.editable(manager, change)

    if (frozen) return rejected(change, frozen)

    // The subscriber is the only writer of the journal (D-2), so the device's
    // stamp reaches the row through the context rather than through a second
    // insert of our own.
    await withSyncWriteContext({ hlc: stamped.hlc, deviceId, authorId: context.userId }, () =>
      applier.apply(manager, change, prepared, context),
    )

    return accepted(change, stamped.hlc, stamped.restamped)
  }
}
