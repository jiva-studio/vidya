import { Inject, Injectable } from '@nestjs/common'
import { EntityManager } from 'typeorm'

import { CLOCK, Clock } from './clock'

/** The server is a device like any other, and this is its device id. */
export const SERVER_DEVICE_ID = 'server'

/**
 * Digits reserved for the physical half. Fifteen covers every millisecond up to
 * the year 33658, which is the point: the width is fixed, so comparing two HLCs
 * as text gives the same answer as comparing them as numbers.
 */
const PHYSICAL_DIGITS = 15

/** Digits reserved for the logical half — a million events in one millisecond. */
const COUNTER_DIGITS = 6

const pad = (value: number, width: number): string => String(value).padStart(width, '0')

/**
 * Formats a hybrid logical clock.
 *
 * Zero-padding is not cosmetic. `SELECT max(hlc)` over text has to return the
 * causally latest row for the seeding below to work, and it only does when
 * every stamp is the same width.
 *
 * @remarks Extension point. When `@vidya/domain`'s `libs/domain/sync` lands
 * (lane P), this formatting and its parser move there and both sides of the
 * wire share one implementation. Until then the format is defined here, once.
 */
export const formatHlc = (physicalMs: number, counter: number, deviceId: string): string =>
  `${pad(physicalMs, PHYSICAL_DIGITS)}-${pad(counter, COUNTER_DIGITS)}-${deviceId}`

/** Reads back the two numeric halves; the device id is whatever follows them. */
export const parseHlc = (hlc: string): { physicalMs: number; counter: number } => ({
  physicalMs: Number(hlc.slice(0, PHYSICAL_DIGITS)),
  counter: Number(hlc.slice(PHYSICAL_DIGITS + 1, PHYSICAL_DIGITS + 1 + COUNTER_DIGITS)),
})

/**
 * The server's own hybrid logical clock.
 *
 * Every row a REST write puts in the journal is stamped here. Two rules make
 * the stamps usable as an ordering:
 *
 * 1. **Never go backwards.** The physical half is `max(wall clock, last seen)`,
 *    so an NTP correction that moves the clock back cannot make a later write
 *    sort before an earlier one.
 * 2. **Start where the journal left off.** On first use the clock is seeded
 *    from `max(hlc)` in the journal, so a restart does not re-issue stamps the
 *    journal already contains.
 *
 * @remarks Extension point (И-2, Д-16). A *client's* HLC arriving above
 * `now() + skew bound` must be restamped by the server rather than rejected,
 * and a collision on `(collection, doc_id, hlc)` with a different body must be
 * restamped too. Both belong to the push path, which is not part of this slice;
 * `next()` is the stamp they will call.
 */
@Injectable()
export class ServerHlcService {
  private physicalMs = 0
  private counter = 0
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

    const wall = this.clock.nowMs()

    if (wall > this.physicalMs) {
      this.physicalMs = wall
      this.counter = 0
    } else {
      this.counter += 1
    }

    return formatHlc(this.physicalMs, this.counter, SERVER_DEVICE_ID)
  }

  /**
   * Picks the journal's high-water mark up, once per process.
   *
   * The lexicographic maximum is the causal maximum because every stamp is
   * zero-padded to the same width — that is the whole reason for the padding.
   */
  private async seed(manager: EntityManager): Promise<void> {
    if (this.seeded) return
    this.seeded = true

    const rows = (await manager.query('SELECT max(hlc) AS hlc FROM sync_journal')) as {
      hlc: string | null
    }[]
    const highest = rows[0]?.hlc

    if (!highest) return

    const { physicalMs, counter } = parseHlc(highest)
    this.physicalMs = physicalMs
    this.counter = counter
  }
}
