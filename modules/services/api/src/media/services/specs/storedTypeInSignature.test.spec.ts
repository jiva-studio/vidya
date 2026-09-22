import { Clock } from '@vidya/api/shared/clock'
import { RedisService } from '@vidya/api/shared/services'
import { MediaId, MediaKind, ReadWindowSeconds, SignedUrl, windowExpiry } from '@vidya/domain'
import { Media } from '@vidya/entities'

import { MediaAddressesService } from '../mediaAddresses.service'
import { SchoolStorageService } from '../schoolStorage.service'

const NOON = Date.UTC(2026, 8, 21, 12, 17, 43, 512)

const clock: Clock = { nowMs: () => NOON }

/** A cache that keeps nothing, so every row reaches the driver. */
const withoutCache = {
  async get(): Promise<string | null> {
    return null
  },
  async set(): Promise<void> {},
}

/** Storage that remembers what it was told about each object it signed. */
const recordingStorage = () => {
  const asked: { key: string; kind: MediaKind; mimeType?: string }[] = []

  const storage = {
    async signRead(key: string, kind: MediaKind, mimeType?: string): Promise<SignedUrl> {
      asked.push({ key, kind, mimeType })

      return {
        url: `memory://bucket/${key}`,
        expiresAt: new Date(windowExpiry(NOON, ReadWindowSeconds[kind])).toISOString(),
      } as SignedUrl
    },
  }

  return { asked, storages: { openProfileById: async () => ({ storage }) } }
}

const rowOf = (kind: MediaKind, mimeType: string): Media =>
  ({
    id: '11111111-1111-4111-8111-111111111111' as MediaId,
    kind,
    mimeType,
    profileId: 'profile',
    storageKey: `school/one/${kind}/file/original.bin`,
  }) as Media

describe('signing a read of a stored file', () => {
  const signing = () => {
    const { asked, storages } = recordingStorage()
    const service = new MediaAddressesService(
      storages as unknown as SchoolStorageService,
      withoutCache as unknown as RedisService,
      clock,
    )

    return { asked, service }
  }

  it('tells storage the type the row recorded, which is what decides the delivery', async () => {
    const { asked, service } = signing()

    await service.signAll([rowOf('image', 'image/svg+xml')])

    expect(asked).toEqual([
      { key: 'school/one/image/file/original.bin', kind: 'image', mimeType: 'image/svg+xml' },
    ])
  })

  it('tells storage each row its own type, not the first one of the batch', async () => {
    const { asked, service } = signing()
    const rows = [rowOf('image', 'image/png'), { ...rowOf('video', 'video/mp4'), id: 'second' }]

    await service.signAll(rows as Media[])

    expect(asked.map((call) => call.mimeType)).toEqual(['image/png', 'video/mp4'])
  })
})
