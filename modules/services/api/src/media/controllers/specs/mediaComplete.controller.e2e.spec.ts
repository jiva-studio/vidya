import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { MediaId, mediaPath, UploadGrant } from '@vidya/domain'
import { MediaRefusals } from '@vidya/protocol'

import { refusalFor, TEST_MASTER_KEY } from './context'
import { createMediaFlow, grantPutFixture, MediaFlow } from './uploadFlow'

const ROUTE = 'POST /media/:id/complete'

const SHA256 = grantPutFixture.request.sha256 as string

type Granted = { mediaId: string; grant: UploadGrant }

describe('saying that the bytes of an upload have landed', () => {
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
      flow.imageUpload(flow.ctx.one.school.id, { sizeBytes: 2048, sha256: SHA256, ...overrides }),
      flow.ctx.one.users.owner,
    )

    expect(response.status).toBe(201)
    return { mediaId: response.body.mediaId, grant: response.body.grant as UploadGrant }
  }

  const complete = async (mediaId: string, body: Record<string, unknown> = { sha256: SHA256 }) =>
    flow.completeUpload(mediaId, body, flow.ctx.one.users.owner)

  const usage = async () =>
    (await flow.usageOf(flow.ctx.one.school.id, flow.ctx.one.users.owner)).body

  it('turns the row ready and answers with the durable path a block stores', async () => {
    const granted = await ask()
    await flow.putBytes(granted.grant, Buffer.alloc(2048, 3))

    const response = await complete(granted.mediaId)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: granted.mediaId,
      status: 'ready',
      url: mediaPath(granted.mediaId as MediaId),
    })
    expect((await flow.mediaRow(granted.mediaId))?.status).toBe('ready')
  })

  it('takes the size and the type from storage rather than from the client', async () => {
    const granted = await ask()
    await flow.putBytes(granted.grant, Buffer.alloc(2048, 3))

    const response = await complete(granted.mediaId)
    const stored = flow.objectBehind(granted.grant)

    expect(flow.storage.calls).toContainEqual(
      expect.objectContaining({ op: 'head', key: flow.keyBehind(granted.grant) }),
    )
    expect(response.body.sizeBytes).toBe(stored?.sizeBytes)
    expect(response.body.mimeType).toBe(stored?.contentType)
  })

  it('adds the bytes storage reported to what the school occupies', async () => {
    const granted = await ask()
    await flow.putBytes(granted.grant, Buffer.alloc(2048, 3))

    await complete(granted.mediaId)

    expect(await usage()).toMatchObject({ usedBytes: 2048, reservedBytes: 0 })
  })

  it('refuses an upload whose bytes never reached storage', async () => {
    const expected = refusalFor(ROUTE, MediaRefusals.notReady)
    const granted = await ask()

    const response = await complete(granted.mediaId)

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toContain(MediaRefusals.notReady)
  })

  it('leaves that row waiting and the quota untouched', async () => {
    const granted = await ask()

    await complete(granted.mediaId)

    expect((await flow.mediaRow(granted.mediaId))?.status).toBe('pending')
    expect(await usage()).toMatchObject({ usedBytes: 0 })
  })

  it('fails the row and deletes the object when storage holds a different number of bytes', async () => {
    const granted = await ask()
    await flow.putBytes(granted.grant, Buffer.alloc(4096, 3))

    await complete(granted.mediaId)

    expect((await flow.mediaRow(granted.mediaId))?.status).toBe('failed')
    expect(flow.objectBehind(granted.grant)).toBeUndefined()
    expect(flow.removalsOf(flow.keyBehind(granted.grant))).toBe(1)
  })

  it('fails the row and deletes the object when storage holds a different type', async () => {
    const granted = await ask()
    await flow.putBytes(granted.grant, Buffer.alloc(2048, 3), 'image/gif')

    await complete(granted.mediaId)

    expect((await flow.mediaRow(granted.mediaId))?.status).toBe('failed')
    expect(flow.objectBehind(granted.grant)).toBeUndefined()
  })

  it('charges nothing and releases the reservation for a file it refused', async () => {
    const granted = await ask()
    await flow.putBytes(granted.grant, Buffer.alloc(4096, 3))

    await complete(granted.mediaId)

    expect(await usage()).toMatchObject({ usedBytes: 0, reservedBytes: 0 })
  })
})

describe('uploading bytes a school already has', () => {
  let app: INestApplication
  let flow: MediaFlow

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
    await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner)
    await flow.configureStorage(flow.ctx.two.school.id, flow.ctx.two.users.technician)
  })

  afterEach(async () => {
    await app.close()
  })

  const store = async (schoolId: string, user = flow.ctx.one.users.owner): Promise<Granted> => {
    const asked = await flow.askUpload(
      flow.imageUpload(schoolId, { sizeBytes: 2048, sha256: SHA256 }),
      user,
    )

    expect(asked.status).toBe(201)
    const granted = { mediaId: asked.body.mediaId, grant: asked.body.grant as UploadGrant }
    await flow.putBytes(granted.grant, Buffer.alloc(2048, 3))
    return granted
  }

  it('answers with the file it already holds instead of storing it twice', async () => {
    const first = await store(flow.ctx.one.school.id)
    await flow.completeUpload(first.mediaId, { sha256: SHA256 }, flow.ctx.one.users.owner)

    const second = await store(flow.ctx.one.school.id)
    const response = await flow.completeUpload(
      second.mediaId,
      { sha256: SHA256 },
      flow.ctx.one.users.owner,
    )

    expect(response.status).toBe(200)
    expect(response.body.id).toBe(first.mediaId)
  })

  it('deletes the copy that was just uploaded and charges the school once', async () => {
    const first = await store(flow.ctx.one.school.id)
    await flow.completeUpload(first.mediaId, { sha256: SHA256 }, flow.ctx.one.users.owner)

    const second = await store(flow.ctx.one.school.id)
    await flow.completeUpload(second.mediaId, { sha256: SHA256 }, flow.ctx.one.users.owner)

    expect(flow.objectBehind(second.grant)).toBeUndefined()
    expect(flow.objectBehind(first.grant)).toBeDefined()
    expect(
      (await flow.usageOf(flow.ctx.one.school.id, flow.ctx.one.users.owner)).body,
    ).toMatchObject({ usedBytes: 2048 })
  })

  it('stores its own copy for another school, whose files are not shared', async () => {
    const mine = await store(flow.ctx.one.school.id)
    await flow.completeUpload(mine.mediaId, { sha256: SHA256 }, flow.ctx.one.users.owner)

    const theirs = await store(flow.ctx.two.school.id, flow.ctx.two.users.technician)
    const response = await flow.completeUpload(
      theirs.mediaId,
      { sha256: SHA256 },
      flow.ctx.two.users.technician,
    )

    expect(response.status).toBe(200)
    expect(response.body.id).toBe(theirs.mediaId)
    expect(flow.objectBehind(theirs.grant)).toBeDefined()
  })
})
