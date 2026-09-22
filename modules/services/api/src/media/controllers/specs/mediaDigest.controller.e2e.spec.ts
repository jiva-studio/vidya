import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { UploadGrant } from '@vidya/domain'

import { TEST_MASTER_KEY } from './context'
import { createMediaFlow, digestOf, MediaFlow } from './uploadFlow'

const MINE = Buffer.alloc(2048, 0xaa)
const THEIRS = Buffer.alloc(2048, 0xbb)

type Granted = { mediaId: string; grant: UploadGrant }

describe('the digest a stored file is recorded and deduplicated under', () => {
  let app: INestApplication
  let flow: MediaFlow

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
    await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner)
  })

  afterEach(async () => {
    await app.close()
  })

  const ask = async (overrides: Record<string, unknown> = {}): Promise<Granted> => {
    const response = await flow.askUpload(
      flow.imageUpload(flow.ctx.one.school.id, { sizeBytes: 2048, ...overrides }),
      flow.ctx.one.users.owner,
    )

    expect(response.status).toBe(201)
    return { mediaId: response.body.mediaId, grant: response.body.grant as UploadGrant }
  }

  const complete = async (mediaId: string, body: Record<string, unknown>) =>
    flow.completeUpload(mediaId, body, flow.ctx.one.users.owner)

  it('records no digest for bytes storage was never asked to verify', async () => {
    const granted = await ask({ sha256: undefined })
    await flow.putBytes(granted.grant, MINE)

    await complete(granted.mediaId, { sha256: digestOf(MINE) })

    expect((await flow.mediaRow(granted.mediaId))?.sha256).toBeNull()
  })

  it('keeps the digest storage verified rather than the one the request declared', async () => {
    const granted = await ask({ sha256: digestOf(MINE) })
    await flow.putBytes(granted.grant, MINE)

    await complete(granted.mediaId, { sha256: digestOf(THEIRS) })

    expect((await flow.mediaRow(granted.mediaId))?.sha256).toBe(digestOf(MINE))
  })

  it('answers an upload with its own file, not one an earlier row laid claim to', async () => {
    const claiming = await ask({ sha256: undefined })
    await flow.putBytes(claiming.grant, MINE)
    await complete(claiming.mediaId, { sha256: digestOf(THEIRS) })

    const honest = await ask({ sha256: digestOf(THEIRS) })
    await flow.putBytes(honest.grant, THEIRS)
    const response = await complete(honest.mediaId, { sha256: digestOf(THEIRS) })

    expect(response.status).toBe(200)
    expect(response.body.id).toBe(honest.mediaId)
  })

  it('leaves the bytes of that upload in storage instead of dropping them as a copy', async () => {
    const claiming = await ask({ sha256: undefined })
    await flow.putBytes(claiming.grant, MINE)
    await complete(claiming.mediaId, { sha256: digestOf(THEIRS) })

    const honest = await ask({ sha256: digestOf(THEIRS) })
    await flow.putBytes(honest.grant, THEIRS)
    await complete(honest.mediaId, { sha256: digestOf(THEIRS) })

    expect(flow.objectBehind(honest.grant)?.body).toEqual(THEIRS)
    expect(flow.removalsOf(flow.keyBehind(honest.grant))).toBe(0)
  })
})
