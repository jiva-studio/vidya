import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { CLOCK } from '@vidya/api/shared/clock'
import { MediaKind } from '@vidya/domain'

import { TEST_MASTER_KEY } from './context'
import { createReadFlow, ReadFlow } from './readFlow'

/**
 * Noon of a fixed day, and the instants around the windows that start there.
 *
 * An hour window and a six-hour window both begin at noon UTC, so one set of
 * constants says what an image and a video are each promised, and the last
 * millisecond of either window can be named exactly.
 */
const MIDDAY = Date.parse('2026-09-21T12:00:00.000Z')
const HOUR = 3_600_000

describe('the instant a playable address dies', () => {
  let app: INestApplication
  let read: ReadFlow
  let now: number

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    now = MIDDAY
    app = await createTestingApp([{ provide: CLOCK, useValue: { nowMs: () => now } }])
    read = await createReadFlow(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const store = (kind: MediaKind) =>
    read.storeReady(read.flow.ctx.one.school.id, read.flow.ctx.one.users.owner, kind)

  const askAt = async (at: number, mediaId: string) => {
    now = at
    const response = await read.askUrls(
      [mediaId],
      await read.tokenOf(read.flow.ctx.one.users.owner),
    )

    expect(response.status).toBe(200)
    return response.body.urls[mediaId] as { url: string; expiresAt: string }
  }

  it('promises an image the hour boundary exactly, asked for mid-window', async () => {
    const mediaId = await store('image')

    const entry = await askAt(MIDDAY + HOUR / 2, mediaId)

    expect(entry.expiresAt).toBe('2026-09-21T13:00:00.000Z')
  })

  it('promises a video the six-hour boundary exactly, asked for at the same instant', async () => {
    const mediaId = await store('video')

    const entry = await askAt(MIDDAY + HOUR / 2, mediaId)

    expect(entry.expiresAt).toBe('2026-09-21T18:00:00.000Z')
  })

  it('gives two readers inside one hour the very same address, signed twice over', async () => {
    const mediaId = await store('image')
    const key = await read.keyOf(mediaId)

    const early = await askAt(MIDDAY + HOUR / 2, mediaId)
    const late = await askAt(MIDDAY + HOUR - 1, mediaId)

    expect(read.signedReadsOf(key)).toBe(2)
    expect(late.url).toBe(early.url)
    expect(late.expiresAt).toBe(early.expiresAt)
  })

  it('gives a different address once the hour has turned', async () => {
    const mediaId = await store('image')

    const before = await askAt(MIDDAY + HOUR - 1, mediaId)
    const after = await askAt(MIDDAY + HOUR, mediaId)

    expect(after.url).not.toBe(before.url)
    expect(before.expiresAt).toBe('2026-09-21T13:00:00.000Z')
    expect(after.expiresAt).toBe('2026-09-21T14:00:00.000Z')
  })

  it('holds a video on one address through the last hour of its six, then moves', async () => {
    const mediaId = await store('video')

    const early = await askAt(MIDDAY + HOUR, mediaId)
    const last = await askAt(MIDDAY + 6 * HOUR - 1, mediaId)
    const next = await askAt(MIDDAY + 6 * HOUR, mediaId)

    expect(last.url).toBe(early.url)
    expect(last.expiresAt).toBe('2026-09-21T18:00:00.000Z')
    expect(next.url).not.toBe(last.url)
    expect(next.expiresAt).toBe('2026-09-22T00:00:00.000Z')
  })
})
