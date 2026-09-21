import { Clock } from '@vidya/api/shared/clock'
import { RedisService } from '@vidya/api/shared/services'
import { MediaId, MediaKind, ReadWindowSeconds, SignedUrl, windowExpiry } from '@vidya/domain'
import { Media } from '@vidya/entities'

import { MediaAddressesService } from '../mediaAddresses.service'
import { SchoolStorageService } from '../schoolStorage.service'

/** Redis with the semantics the service relies on, and a record of the writes. */
class RecordingRedis {
  readonly store = new Map<string, string>()
  readonly writes: { key: string; seconds: number }[] = []

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string, seconds: number): Promise<void> {
    this.writes.push({ key, seconds })
    this.store.set(key, value)
  }
}

/**
 * An instant well inside an hour, so the boundary the expiry is rounded to is
 * an exact number a test can name rather than whatever the run happened at.
 */
const NOON = Date.UTC(2026, 8, 21, 12, 17, 43, 512)

/** Storage that says what it was asked to sign, and signs an address per call. */
const recordingStorage = (clock: Clock) => {
  const signed: string[] = []
  let issued = 0

  const storage = {
    async signRead(key: string, kind: MediaKind): Promise<SignedUrl> {
      signed.push(key)
      issued += 1

      return {
        url: `memory://bucket/${key}?sig=${issued}`,
        expiresAt: new Date(windowExpiry(clock.nowMs(), ReadWindowSeconds[kind])).toISOString(),
      } as SignedUrl
    },
  }

  return { signed, storages: { openProfileById: async () => ({ storage }) } }
}

const rowOf = (kind: MediaKind, id: string): Media =>
  ({
    id: id as MediaId,
    kind,
    profileId: 'profile',
    storageKey: `school/one/${kind}/${id}`,
  }) as Media

const open = (from = NOON) => {
  const redis = new RecordingRedis()
  let nowMs = from
  const clock: Clock = { nowMs: () => nowMs }
  const { signed, storages } = recordingStorage(clock)

  const service = new MediaAddressesService(
    storages as unknown as SchoolStorageService,
    redis as unknown as RedisService,
    clock,
  )

  const moveTo = (instant: number) => {
    nowMs = instant
  }

  return { service, redis, signed, moveTo }
}

describe('handing out a playable address', () => {
  it('signs a file once for a window and answers the next asker from Redis', async () => {
    const { service, signed } = open()
    const row = rowOf('image', '11111111-1111-4111-8111-111111111111')

    const first = await service.signAll([row])
    const second = await service.signAll([row])

    expect(signed).toHaveLength(1)
    expect(second[row.id]).toEqual(first[row.id])
  })

  it('keeps a cached address for eight tenths of the window it belongs to', async () => {
    const { service, redis } = open()

    await service.signAll([rowOf('image', '22222222-2222-4222-8222-222222222222')])
    await service.signAll([rowOf('video', '33333333-3333-4333-8333-333333333333')])

    expect(redis.writes.map((write) => write.seconds)).toEqual([
      ReadWindowSeconds.image * 0.8,
      ReadWindowSeconds.video * 0.8,
    ])
  })

  it('names the window the clock is in, to the millisecond, in the key', async () => {
    const { service, redis } = open()
    const row = rowOf('image', '44444444-4444-4444-8444-444444444444')

    await service.signAll([row])

    expect(redis.writes[0].key).toBe(
      `media:address:${row.id}:${Date.UTC(2026, 8, 21, 13, 0, 0, 0)}`,
    )
  })

  it('signs afresh for the asker the clock has carried past the boundary', async () => {
    const { service, signed, moveTo } = open()
    const row = rowOf('image', '88888888-8888-4888-8888-888888888888')

    const inside = await service.signAll([row])
    moveTo(Date.UTC(2026, 8, 21, 13, 0, 0, 1))
    const after = await service.signAll([row])

    expect(signed).toHaveLength(2)
    expect(after[row.id].url).not.toBe(inside[row.id].url)
    expect(after[row.id].expiresAt).not.toBe(inside[row.id].expiresAt)
  })

  it('signs again rather than failing when what was cached cannot be read', async () => {
    const { service, redis, signed } = open()
    const row = rowOf('image', '55555555-5555-4555-8555-555555555555')

    await service.signAll([row])
    redis.store.set(redis.writes[0].key, 'not json at all')

    const again = await service.signAll([row])

    expect(signed).toHaveLength(2)
    expect(again[row.id].url).toContain('sig=2')
  })

  it('answers every file of a batch, keyed by the id that was asked for', async () => {
    const { service } = open()
    const rows = [
      rowOf('image', '66666666-6666-4666-8666-666666666666'),
      rowOf('audio', '77777777-7777-4777-8777-777777777777'),
    ]

    const answered = await service.signAll(rows)

    expect(Object.keys(answered).sort()).toEqual(rows.map((row) => row.id).sort())
  })
})
