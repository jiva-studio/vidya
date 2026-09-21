import { Inject, Injectable, Logger } from '@nestjs/common'
import { CLOCK, Clock } from '@vidya/api/shared/clock'
import { RedisService } from '@vidya/api/shared/services'
import { MediaId, ReadWindowSeconds, SignedUrl, windowExpiry } from '@vidya/domain'
import { Media } from '@vidya/entities'

import { SchoolStorageService } from './schoolStorage.service'

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
 *
 * The cache is an economy and never a dependency. Signing is local arithmetic,
 * so a Redis nobody can reach costs a round trip and nothing else — every
 * failure of it is answered with a freshly signed address rather than with a
 * refused screen.
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
    const expiresAtMs = windowExpiry(this.clock.nowMs(), ReadWindowSeconds[media.kind])
    const key = cacheKeyOf(media.id, expiresAtMs)

    const held = await this.readCached(key, expiresAtMs)
    if (held) return held

    const opened = await this.storages.openProfileById(media.profileId)
    const address = await opened.storage.signRead(media.storageKey, media.kind, media.mimeType)

    // The address is what was asked for; keeping a copy of it is not, so the
    // batch is answered without waiting to hear whether the copy was taken.
    void this.keepCached(key, address, expiresAtMs)

    return address
  }

  /** Kept for exactly as long as the address it holds still works. */
  private async keepCached(key: string, address: SignedUrl, expiresAtMs: number): Promise<void> {
    const seconds = Math.floor((expiresAtMs - this.clock.nowMs()) / 1000)

    try {
      await this.redis.set(key, JSON.stringify(address), seconds)
    } catch {
      // The key is named and the value never is, because the value is the access.
      this.logger.warn(`Could not cache the address at ${key}`)
    }
  }

  /**
   * The address this window was signed with, if one is held and still holds.
   *
   * The expiry is compared rather than trusted: an entry naming any instant but
   * the boundary asked for was cut to another window or has already died, and
   * either way it is worth no more than an empty cache.
   */
  private async readCached(key: string, expiresAtMs: number): Promise<SignedUrl | undefined> {
    const held = await this.readRaw(key)
    if (!held) return undefined

    try {
      const address = JSON.parse(held) as SignedUrl
      return Date.parse(address.expiresAt) === expiresAtMs ? address : undefined
    } catch {
      this.logger.warn(`Unreadable cached address at ${key}`)
      return undefined
    }
  }

  private async readRaw(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key)
    } catch {
      this.logger.warn(`Could not read the cached address at ${key}`)
      return null
    }
  }
}
