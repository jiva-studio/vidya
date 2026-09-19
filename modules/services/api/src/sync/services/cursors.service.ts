import { Injectable } from '@nestjs/common'
import * as domain from '@vidya/domain'
import { DataSource } from 'typeorm'

/**
 * What each device has acknowledged applying.
 *
 * Kept for the journal's sake rather than the device's: the device knows its
 * own positions, and this is the answer to "may this row be discarded yet".
 *
 * The stored value never goes down. Acknowledgements can arrive out of order —
 * a retried request carries the position it had when it was first built — and a
 * later one overwriting a higher one would invite a compaction to drop rows a
 * device has already agreed it holds.
 */
@Injectable()
export class SyncCursorsService {
  constructor(private readonly dataSource: DataSource) {}

  async acknowledge(userId: domain.UserId, deviceId: string, ackedSeq: number): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO sync_device_cursors (device_id, user_id, acked_seq, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (device_id, user_id) DO UPDATE
         SET acked_seq  = GREATEST(sync_device_cursors.acked_seq, EXCLUDED.acked_seq),
             updated_at = now()`,
      [deviceId, userId, String(ackedSeq)],
    )
  }

  /** The acknowledged position, or `0` when this device has never reported one. */
  async acknowledged(userId: domain.UserId, deviceId: string): Promise<number> {
    const rows: { acked_seq: string }[] = await this.dataSource.query(
      'SELECT acked_seq FROM sync_device_cursors WHERE device_id = $1 AND user_id = $2',
      [deviceId, userId],
    )

    return Number(rows[0]?.acked_seq ?? 0)
  }
}
