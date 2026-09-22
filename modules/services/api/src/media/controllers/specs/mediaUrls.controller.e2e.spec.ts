import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { asId, MediaId, mediaPath } from '@vidya/domain'

import { TEST_MASTER_KEY } from './context'
import { createReadFlow, ReadFlow } from './readFlow'

const FIXTURE = join(
  dirname(require.resolve('@vidya/protocol/package.json')),
  '__fixtures__',
  'media',
  'resolve-urls.json',
)

/** The wire shape one entry of the answer has, read from the shared fixture. */
const signedShape = (): string[] => {
  const { response } = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
    response: { urls: Record<string, Record<string, unknown>> }
  }

  return Object.keys(Object.values(response.urls)[0]).sort()
}

describe('asking for a playable address', () => {
  let app: INestApplication
  let read: ReadFlow

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    read = await createReadFlow(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const ownFile = () => read.storeReady(read.flow.ctx.one.school.id, read.flow.ctx.one.users.owner)

  const foreignFile = () =>
    read.storeReady(read.flow.ctx.two.school.id, read.flow.ctx.two.users.technician)

  const asStaffOfOne = () => read.tokenOf(read.flow.ctx.one.users.owner)

  it('answers a member of staff with a signature and the instant it stops working', async () => {
    const mediaId = await ownFile()

    const response = await read.askUrls([mediaId], await asStaffOfOne())

    expect(response.status).toBe(200)
    expect(Object.keys(response.body.urls).sort()).toEqual([mediaId])
    expect(Object.keys(response.body.urls[mediaId]).sort()).toEqual(signedShape())
    expect(Date.parse(response.body.urls[mediaId].expiresAt)).toBeGreaterThan(Date.now())
  })

  it('leaves out the files of a school they do not work for, and signs none of them', async () => {
    const theirs = await foreignFile()
    const key = await read.keyOf(theirs)

    const response = await read.askUrls([theirs], await asStaffOfOne())

    expect(response.status).toBe(200)
    expect(response.body.urls).toEqual({})
    expect(read.signedReadsOf(key)).toBe(0)
  })

  it("says of another school's file exactly what it says of one that never existed", async () => {
    const theirs = await foreignFile()
    const never = faker.string.uuid()

    const foreign = await read.askUrls([theirs], await asStaffOfOne())
    const absent = await read.askUrls([never], await asStaffOfOne())

    expect(absent.status).toBe(foreign.status)
    expect(absent.body).toEqual(foreign.body)
  })

  it('draws what it can when the only file left in old content is gone', async () => {
    const mine = await ownFile()
    const removed = faker.string.uuid()

    const alone = await read.askUrls([removed], await asStaffOfOne())
    const beside = await read.askUrls([removed, mine], await asStaffOfOne())

    expect(alone.status).toBe(200)
    expect(alone.body.urls).toEqual({})
    expect(Object.keys(beside.body.urls)).toEqual([mine])
  })

  it('answers a file whose bytes have not landed yet without refusing the screen', async () => {
    const asked = await read.flow.askUpload(
      read.flow.imageUpload(read.flow.ctx.one.school.id),
      read.flow.ctx.one.users.owner,
    )

    expect(asked.status).toBe(201)

    const response = await read.askUrls([asked.body.mediaId], await asStaffOfOne())

    expect(response.status).toBe(200)
    expect(response.body.urls).toEqual({})
  })

  it('signs a file named twice in one screen once, and answers it once', async () => {
    const mine = await ownFile()
    const key = await read.keyOf(mine)

    const response = await read.askUrls([mine, mine, mine], await asStaffOfOne())

    expect(response.status).toBe(200)
    expect(Object.keys(response.body.urls)).toEqual([mine])
    expect(read.signedReadsOf(key)).toBe(1)
  })

  it('refuses a screen asking for more files than a batch may carry', async () => {
    const mine = await ownFile()
    const overlong = Array.from({ length: 101 }, () => faker.string.uuid())

    const refused = await read.askUrls(overlong, await asStaffOfOne())
    const allowed = await read.askUrls([mine, ...overlong.slice(0, 99)], await asStaffOfOne())

    expect(refused.status).toBe(400)
    expect(allowed.status).toBe(200)
  })

  it('answers with the files it may read and leaves the others out, never as null', async () => {
    const mine = await ownFile()
    const theirs = await foreignFile()

    const response = await read.askUrls([mine, theirs], await asStaffOfOne())

    expect(response.status).toBe(200)
    expect(Object.keys(response.body.urls)).toEqual([mine])
    expect(theirs in response.body.urls).toBe(false)
    expect(response.body.urls[mine].url).toBeTruthy()
  })

  it('answers an empty ask with an empty answer, having nothing to refuse', async () => {
    const response = await read.askUrls([], await asStaffOfOne())

    expect(response.status).toBe(200)
    expect(response.body.urls).toEqual({})
  })

  it('hands back an address storage answers to, never the path the lesson stored', async () => {
    const mediaId = await ownFile()

    const response = await read.askUrls([mediaId], await asStaffOfOne())

    expect(response.status).toBe(200)
    expect(response.body.urls[mediaId].url).not.toBe(mediaPath(asId<MediaId>(mediaId)))
    expect(response.body.urls[mediaId].url).not.toContain('/media/')
    expect(response.body.urls[mediaId].url).toMatch(/^[a-z0-9+.-]+:\/\//i)
  })

  it('keeps the library answering with the durable path, which is not playable', async () => {
    const mediaId = await ownFile()

    const listed = await read.flow.listMedia(
      { schoolId: read.flow.ctx.one.school.id },
      read.flow.ctx.one.users.owner,
    )

    expect(listed.status).toBe(200)
    expect(listed.body.items.map((item: { url: string }) => item.url)).toEqual([
      mediaPath(asId<MediaId>(mediaId)),
    ])
  })

  it('tells an unauthenticated caller nothing at all', async () => {
    const mediaId = await ownFile()

    const response = await read.askUrls([mediaId], 'Bearer not-a-token')

    expect(response.status).toBe(401)
  })
})
