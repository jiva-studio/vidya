import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

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

  it('refuses a member of staff the files of a school they do not work for', async () => {
    const theirs = await foreignFile()

    const response = await read.askUrls([theirs], await asStaffOfOne())

    expect(response.status).toBe(403)
    expect(response.body.urls).toBeUndefined()
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
