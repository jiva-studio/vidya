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
 * The server's own hybrid logical clock: every row a REST write puts in the
 * journal is stamped here. The value object lives in `@vidya/domain` so that
 * both sides of the wire parse and compare stamps with one implementation.
 *
 * Two invariants come from `hlcNow`: the physical half is `max(wall clock, last
 * seen)`, so a clock correction cannot sort a later write before an earlier
 * one, and the clock is seeded from `max(hlc)` in the journal, so a restart
 * does not re-issue stamps the journal already holds. The third is local — the
 * device id carries a per-instance discriminator, `server:<uuid>`, because
 * `lastSeen` orders the writes of one process only. Without it, two instances
 * stamping the same document in the same millisecond emit the same string, and
 * the journal's unique `(collection, doc_id, hlc)` index drops the second row
 * through `ON CONFLICT DO NOTHING`.
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
