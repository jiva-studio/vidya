import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { MediaKind } from '@vidya/domain'

import { storageProfileFixture, TEST_MASTER_KEY } from './context'
import { createMediaFlow, MediaFlow } from './uploadFlow'

const UPLOADS: Readonly<Record<MediaKind, { mimeType: string; name: string }>> = Object.freeze({
  image: { mimeType: 'image/png', name: 'cover.png' },
  audio: { mimeType: 'audio/mpeg', name: 'lecture.mp3' },
  video: { mimeType: 'video/mp4', name: 'darshan.mp4' },
})

describe('what the usage route tells a school about its storage', () => {
  let app: INestApplication
  let flow: MediaFlow
  let schoolId: string

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
    schoolId = flow.ctx.one.school.id
  })

  afterEach(async () => {
    await app.close()
  })

  const store = async (kind: MediaKind, sizeBytes: number): Promise<void> => {
    const asked = await flow.askUpload(
      flow.imageUpload(schoolId, { kind, ...UPLOADS[kind], sizeBytes, sha256: undefined }),
      flow.ctx.one.users.owner,
    )

    expect(asked.status).toBe(201)
    await flow.putBytes(asked.body.grant, Buffer.alloc(sizeBytes, 2))

    const completed = await flow.completeUpload(asked.body.mediaId, {}, flow.ctx.one.users.owner)
    expect(completed.status).toBe(200)
  }

  const usage = async () => (await flow.usageOf(schoolId, flow.ctx.one.users.owner)).body

  it('counts the ready files of each kind separately', async () => {
    await flow.configureStorage(schoolId, flow.ctx.one.users.owner)
    await store('image', 2048)
    await store('image', 3072)
    await store('audio', 4096)

    expect(await usage()).toMatchObject({
      usedBytes: 9216,
      reservedBytes: 0,
      quotaBytes: storageProfileFixture.request.quotaBytes,
      countsByKind: { image: 2, audio: 1, video: 0 },
    })
  })

  it('answers with nothing beyond what a school occupies, reserves and may occupy', async () => {
    await flow.configureStorage(schoolId, flow.ctx.one.users.owner)

    expect(Object.keys(await usage()).sort()).toEqual([
      'countsByKind',
      'quotaBytes',
      'reservedBytes',
      'usedBytes',
    ])
  })
})
