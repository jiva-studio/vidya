import { INestApplication } from '@nestjs/common'
import { FakeRedis } from '@vidya/api/auth/controllers/specs/context'
import { createTestingApp, TestingOverride } from '@vidya/api/edu/shared'
import { RedisService } from '@vidya/api/shared/services'
import { MediaKind, ReadWindowSeconds, windowExpiry } from '@vidya/domain'

import { TEST_MASTER_KEY } from './context'
import { createReadFlow, ReadFlow } from './readFlow'

/**
 * The expiries a signature taken between these two instants may carry.
 *
 * Two rather than one because a window boundary can fall between the request
 * and the assertion, and a suite that named a single instant would fail once an
 * hour for a reason that has nothing to do with the behaviour.
 */
const boundaries = (kind: MediaKind, from: number, to: number): string[] => [
  ...new Set(
    [from, to].map((at) => new Date(windowExpiry(at, ReadWindowSeconds[kind])).toISOString()),
  ),
]

/**
 * Whether an expiry sits on the grid this kind's window divides time into.
 *
 * Stated as a grid rather than as "more than an hour of life left", which is
 * what this suite asked for first and was wrong to: rounding up to a boundary
 * leaves a remainder anywhere in the window, so a run inside the last hour of
 * a six-hour window has minutes left and is no less correct for it. The grid
 * holds at every instant, and a video handed an hourly window falls off it —
 * except on the one boundary in six where the two grids meet, which is why the
 * criterion is also pinned to `windowExpiry` by kind above.
 */
const onGrid = (kind: MediaKind, expiresAt: string): boolean =>
  Date.parse(expiresAt) % (ReadWindowSeconds[kind] * 1000) === 0

describe('how long a playable address lasts', () => {
  let app: INestApplication
  let read: ReadFlow

  const boot = async (overrides: readonly TestingOverride[] = []) => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp(overrides)
    read = await createReadFlow(app)
  }

  afterEach(async () => {
    await app.close()
  })

  const store = (kind: MediaKind) =>
    read.storeReady(read.flow.ctx.one.school.id, read.flow.ctx.one.users.owner, kind)

  const staff = () => read.tokenOf(read.flow.ctx.one.users.owner)

  const askFor = async (mediaId: string) => {
    const before = Date.now()
    const response = await read.askUrls([mediaId], await staff())
    const after = Date.now()

    expect(response.status).toBe(200)
    return { entry: response.body.urls[mediaId], before, after }
  }

  it('gives an image an hour, rounded up to the boundary of its window', async () => {
    await boot()
    const mediaId = await store('image')

    const { entry, before, after } = await askFor(mediaId)

    expect(boundaries('image', before, after)).toContain(entry.expiresAt)
  })

  it('gives a video six hours, because a signature must outlast the lecture', async () => {
    await boot()
    const mediaId = await store('video')

    const { entry, before, after } = await askFor(mediaId)

    expect(boundaries('video', before, after)).toContain(entry.expiresAt)
    expect(onGrid('video', entry.expiresAt)).toBe(true)
  })

  it('gives audio the same six hours a video gets', async () => {
    await boot()
    const mediaId = await store('audio')

    const { entry, before, after } = await askFor(mediaId)

    expect(boundaries('audio', before, after)).toContain(entry.expiresAt)
    expect(onGrid('audio', entry.expiresAt)).toBe(true)
  })

  it('never expires a video before the image asked for beside it', async () => {
    await boot()
    const ids = { video: await store('video'), image: await store('image') }

    const answered = await read.askUrls([ids.video, ids.image], await staff())

    expect(answered.status).toBe(200)
    const video = answered.body.urls[ids.video].expiresAt
    const image = answered.body.urls[ids.image].expiresAt

    expect(onGrid('video', video)).toBe(true)
    expect(onGrid('image', image)).toBe(true)
    expect(Date.parse(video)).toBeGreaterThanOrEqual(Date.parse(image))
  })

  it('hands two askers inside one window the very same bytes of address', async () => {
    await boot()
    const mediaId = await store('image')
    const key = await read.keyOf(mediaId)

    const first = await askFor(mediaId)
    const second = await askFor(mediaId)

    // Nothing was cached: the answers match because the expiry is rounded to
    // the window, which is what lets a CDN and a browser hold one copy.
    expect(read.signedReadsOf(key)).toBe(2)
    expect(second.entry.url).toBe(first.entry.url)
    expect(second.entry.expiresAt).toBe(first.entry.expiresAt)
  })

  it('serves the second asker from Redis instead of troubling storage again', async () => {
    await boot([{ provide: RedisService, useValue: new FakeRedis() }])
    const mediaId = await store('image')
    const key = await read.keyOf(mediaId)

    const first = await askFor(mediaId)
    const second = await askFor(mediaId)

    expect(read.signedReadsOf(key)).toBe(1)
    expect(second.entry).toEqual(first.entry)
  })
})
