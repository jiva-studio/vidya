import { Inject, Injectable, Logger } from '@nestjs/common'
import { CLOCK, Clock } from '@vidya/api/shared/clock'
import { RedisService } from '@vidya/api/shared/services'
import { MediaId, ReadWindowSeconds, SignedUrl, windowExpiry } from '@vidya/domain'
import { Media } from '@vidya/entities'

import { SchoolStorageService } from './schoolStorage.service'

/**
 * How much of the window a cached address is kept for.
 *
 * Short of the whole window on purpose: an address handed out at the very end
 * of its cached life still has to be worth loading, so the last fifth of the
 * window is signed afresh rather than served from a copy that is about to stop
 * working.
 */
const CachedShareOfWindow = 0.8

const cacheKeyOf = (mediaId: MediaId, expiresAtMs: number): string =>
  `media:address:${mediaId}:${expiresAtMs}`

/**
 * Playable addresses, signed once per window and shared by everyone inside it.
 *
 * The expiry is rounded up to the window boundary, so every reader of the same
 * file gets the same bytes of address and a CDN and a browser can hold one
 * copy. That is also what makes the cache sound: the entry is keyed by the
 * boundary it expires at, so a window that has rolled over cannot be answered
 * from the last one's signature.
 */
@Injectable()
export class MediaAddressesService {
  private readonly logger = new Logger(MediaAddressesService.name)

  constructor(
    private readonly storages: SchoolStorageService,
    private readonly redis: RedisService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async signAll(rows: Media[]): Promise<Record<string, SignedUrl>> {
    const signed = await Promise.all(
      rows.map(async (row) => [row.id, await this.sign(row)] as const),
    )

    return Object.fromEntries(signed)
  }

  private async sign(media: Media): Promise<SignedUrl> {
    const windowSeconds = ReadWindowSeconds[media.kind]
    const key = cacheKeyOf(media.id, windowExpiry(this.clock.nowMs(), windowSeconds))

    const held = await this.readCached(key)
    if (held) return held

    const opened = await this.storages.openProfileById(media.profileId)
    const address = await opened.storage.signRead(media.storageKey, media.kind)

    await this.redis.set(
      key,
      JSON.stringify(address),
      Math.floor(windowSeconds * CachedShareOfWindow),
    )

    return address
  }

  private async readCached(key: string): Promise<SignedUrl | undefined> {
    const held = await this.redis.get(key)
    if (!held) return undefined

    try {
      return JSON.parse(held) as SignedUrl
    } catch {
      // A value we cannot read is worth no more than an empty cache: the
      // address is signed again. The key is named, never the value, because
      // the value is the access.
      this.logger.warn(`Unreadable cached address at ${key}`)
      return undefined
    }
  }
}
