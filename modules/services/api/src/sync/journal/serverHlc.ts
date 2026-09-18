import { randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { Hlc, hlcNow, hlcToString, parseHlc } from '@vidya/domain'
import { EntityManager } from 'typeorm'

import { CLOCK, Clock } from './clock'

/**
 * The prefix every server-issued stamp carries. It is a prefix rather than the
 * whole id: see {@link ServerHlcService} for the discriminator that follows it.
 */
export const SERVER_DEVICE_ID = 'server'

/** The device id of one running instance — `server:<instance>`. */
export const serverDeviceId = (instance: string): string => `${SERVER_DEVICE_ID}:${instance}`

/** `true` when the stamp was issued by some instance of this server. */
export const isServerDeviceId = (deviceId: string): boolean =>
  deviceId === SERVER_DEVICE_ID || deviceId.startsWith(`${SERVER_DEVICE_ID}:`)

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
 * **Why the device id is not the bare `server` (D-1).** `lastSeen` and `seeded`
 * are fields of one object in one process, so they order the writes of that
 * process and of nothing else. Two API instances stamping the same document in
 * the same millisecond therefore produced the *same string*, and the journal's
 * `(collection, doc_id, hlc)` index swallowed the second row through
 * `ON CONFLICT DO NOTHING` — a lost write answered with `200`, invisible to
 * every device because no later event for that document would ever follow.
 *
 * So each instance appends a discriminator of its own: the third HLC component
 * is `server:<uuid>`, drawn once when the service is constructed. An HLC's
 * device id is its final tiebreak and may itself contain `:` (`parseHlc` reads
 * everything past the second separator as the id), so nothing about the wire
 * format changes: the physical and counter halves keep their fixed widths and
 * text order stays causal order.
 *
 * Alternatives weighed. *Hostname or pid* reads better in a log but is not a
 * guarantee — containers share hostnames, and a pid is reused — and a stamp
 * that is nearly unique is a lost write that happens rarely instead of often.
 * *Seeding the counter from the journal on collision* costs a read on the write
 * path and still leaves the window between the read and the insert. Restarting
 * with a fresh id is harmless: monotonicity is carried by the physical half and
 * by seeding from `max(hlc)`, not by the id.
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

  /** This instance's id, and the reason two instances cannot collide. */
  private readonly deviceId = serverDeviceId(randomUUID())

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  /**
   * The next stamp, strictly greater than every stamp this server has issued.
   *
   * @param manager the transaction the caller is already in, so seeding cannot
   * open a connection of its own and deadlock against the journal's lock.
   */
  async next(manager: EntityManager): Promise<string> {
    await this.seed(manager)

    this.lastSeen = hlcNow(this.deviceId, this.lastSeen, this.clock.nowMs())

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
