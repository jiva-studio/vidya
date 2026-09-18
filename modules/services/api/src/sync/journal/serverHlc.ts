import { Inject, Injectable } from '@nestjs/common'
import { Hlc, hlcNow, hlcToString, parseHlc } from '@vidya/domain'
import { EntityManager } from 'typeorm'

import { CLOCK, Clock } from './clock'

/** The server is a device like any other, and this is its device id. */
export const SERVER_DEVICE_ID = 'server'

/**
 * The server's own hybrid logical clock.
 *
 * Every row a REST write puts in the journal is stamped here. The value object
 * itself lives in `@vidya/domain` so that both sides of the wire read and
 * compare stamps with one implementation: a server that formatted its own
 * would emit strings the device cannot parse, and the mismatch would surface
 * as silently wrong ordering rather than as an error.
 *
 * Two rules make the stamps usable as an ordering, both of them `hlcNow`'s:
 *
 * 1. **Never go backwards.** The physical half is `max(wall clock, last seen)`,
 *    so an NTP correction that moves the clock back cannot make a later write
 *    sort before an earlier one.
 * 2. **Start where the journal left off.** On first use the clock is seeded
 *    from `max(hlc)` in the journal, so a restart does not re-issue stamps the
 *    journal already contains.
 *
 * @remarks Extension point (I-2, D-16). A *client's* HLC arriving above
 * `now() + SYNC_CLOCK_SKEW_TOLERANCE_MS` must be restamped by the server
 * rather than rejected, and a collision on `(collection, doc_id, hlc)` with a
 * different body must be restamped too. Both belong to the push path;
 * `next()` is the stamp they call.
 */
@Injectable()
export class ServerHlcService {
  private lastSeen: Hlc | null = null
  private seeded = false

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  /**
   * The next stamp, strictly greater than every stamp this server has issued.
   *
   * @param manager the transaction the caller is already in, so seeding cannot
   * open a connection of its own and deadlock against the journal's lock.
   */
  async next(manager: EntityManager): Promise<string> {
    await this.seed(manager)

    this.lastSeen = hlcNow(SERVER_DEVICE_ID, this.lastSeen, this.clock.nowMs())

    return hlcToString(this.lastSeen)
  }

  /**
   * Picks the journal's high-water mark up, once per process.
   *
   * The lexicographic maximum is the causal maximum because every stamp is
   * zero-padded to the same width — that is the whole reason for the padding,
   * and why the widths belong to the shared value object rather than here.
   */
  private async seed(manager: EntityManager): Promise<void> {
    if (this.seeded) return
    this.seeded = true

    const rows = (await manager.query('SELECT max(hlc) AS hlc FROM sync_journal')) as {
      hlc: string | null
    }[]
    const highest = rows[0]?.hlc

    if (!highest) return

    this.lastSeen = parseHlc(highest)
  }
}
