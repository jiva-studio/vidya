import { Injectable } from '@nestjs/common'
import * as domain from '@vidya/domain'
import {
  PushRequest,
  PushResponse,
  PushResult,
  SYNC_MAX_BATCH_BYTES,
  SYNC_MAX_PUSH_CHANGES,
} from '@vidya/protocol'

import { SyncRequestException } from '../errors'
import { SyncPushRowService } from './push/row.service'

/**
 * How far this device's own writes have reached the journal (I-6).
 *
 * Without it the interface can paint a state that does not yet contain the
 * answer the student has just written: a push and the pull after it are two
 * requests, and a page prepared between them is entitled to be missing it.
 */
const checkpoint = (results: readonly PushResult[]): number =>
  results
    .filter((result) => result.status === 'accepted')
    .reduce((highest, result) => Math.max(highest, result.outboxId), 0)

/**
 * A batch of local changes, answered row by row.
 *
 * Strictly in array order (D-12): two offline edits of one document must land
 * in the order they were made, and nothing else in the protocol says which came
 * first. That is why the rows are not applied in parallel, however tempting it
 * looks — concurrency here would silently reorder a student's own corrections.
 */
@Injectable()
export class SyncPushService {
  constructor(private readonly rows: SyncPushRowService) {}

  async push(userId: domain.UserId, request: PushRequest): Promise<PushResponse> {
    this.assertFits(request)

    const results: PushResult[] = []

    for (const change of request.changes) {
      results.push(await this.rows.apply(userId, request.deviceId, change))
    }

    return { results, journaledOutboxId: checkpoint(results) }
  }

  /**
   * The two ceilings that describe the request rather than a row.
   *
   * A batch over them is refused whole, with a code: unlike an oversized single
   * row, there is no row to blame and nothing useful to answer per row.
   */
  private assertFits(request: PushRequest): void {
    if (request.changes.length > SYNC_MAX_PUSH_CHANGES) {
      throw new SyncRequestException(
        'batchTooLarge',
        `at most ${SYNC_MAX_PUSH_CHANGES} changes per push`,
      )
    }

    if (Buffer.byteLength(JSON.stringify(request.changes)) > SYNC_MAX_BATCH_BYTES) {
      throw new SyncRequestException(
        'batchTooLarge',
        `a push body may not exceed ${SYNC_MAX_BATCH_BYTES} bytes`,
      )
    }
  }
}
