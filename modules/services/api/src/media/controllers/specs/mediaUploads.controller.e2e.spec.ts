import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { UploadGrant } from '@vidya/domain'
import { MediaRefusals } from '@vidya/protocol'

import { refusalFor, TEST_MASTER_KEY } from './context'
import { createMediaFlow, MediaFlow } from './uploadFlow'

const ROUTE = 'POST /media/uploads'

/**
 * What the grant binds, read off the grant whichever way the provider expresses
 * it: a signed header on a presigned PUT, a policy condition where POST
 * policies exist.
 */
const bindingOf = (grant: UploadGrant): { contentType?: string; size?: string } =>
  grant.method === 'put'
    ? { contentType: grant.headers['Content-Type'], size: grant.headers['Content-Length'] }
    : { contentType: grant.fields['Content-Type'], size: grant.fields['content-length-range'] }

const checksumKeys = (grant: UploadGrant): string[] =>
  [...Object.keys(grant.headers), ...Object.keys(grant.fields)].filter((name) =>
    /checksum|sha256/i.test(name),
  )

describe('asking for permission to upload a file', () => {
  let app: INestApplication
  let flow: MediaFlow

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const configure = async (extra: Record<string, unknown> = {}) =>
    flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner, extra)

  const ask = async (overrides: Record<string, unknown> = {}) =>
    flow.askUpload(flow.imageUpload(flow.ctx.one.school.id, overrides), flow.ctx.one.users.owner)

  it('creates a row waiting for its bytes before it signs anything', async () => {
    await configure()

    const response = await ask()

    expect(response.status).toBe(201)
    const row = await flow.mediaRow(response.body.mediaId)
    expect(row?.status).toBe('pending')
    expect(row?.schoolId).toBe(flow.ctx.one.school.id)
  })

  it('puts the id of that row inside the object key', async () => {
    await configure()

    const response = await ask()
    const row = await flow.mediaRow(response.body.mediaId)

    expect(row?.storageKey).toContain(response.body.mediaId)
    expect(flow.keyBehind(response.body.grant as UploadGrant)).toBe(row?.storageKey)
  })

  it('signs the very key the row was stored under', async () => {
    await configure()

    const response = await ask()
    const row = await flow.mediaRow(response.body.mediaId)

    expect(flow.storage.calls).toContainEqual(
      expect.objectContaining({ op: 'signUpload', key: row?.storageKey }),
    )
  })

  it('hands back a grant that has not expired yet', async () => {
    await configure()

    const response = await ask()
    const grant = response.body.grant as UploadGrant

    expect(Date.parse(grant.expiresAt)).toBeGreaterThan(Date.now())
  })

  it('binds the declared size and type to the grant it signs', async () => {
    await configure()

    const response = await ask({ sizeBytes: 4096, mimeType: 'image/png' })

    expect(bindingOf(response.body.grant as UploadGrant)).toEqual({
      contentType: 'image/png',
      size: expect.stringContaining('4096'),
    })
  })

  it('refuses a type that is not on the white list', async () => {
    await configure()
    const expected = refusalFor(ROUTE, MediaRefusals.typeNotAllowed)

    const response = await ask({ mimeType: 'application/x-msdownload' })

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toContain(MediaRefusals.typeNotAllowed)
  })

  it('refuses an SVG, which a browser executes as a document', async () => {
    await configure()
    const expected = refusalFor(ROUTE, MediaRefusals.typeNotAllowed)

    const response = await ask({ mimeType: 'image/svg+xml', name: 'diagram.svg' })

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toContain(MediaRefusals.typeNotAllowed)
  })

  it('refuses a file that does not fit the quota before any byte is signed', async () => {
    await configure({ quotaBytes: 4096 })
    const expected = refusalFor(ROUTE, MediaRefusals.quotaExceeded)

    const response = await ask({ sizeBytes: 5000 })

    expect(response.status).toBe(expected.status)
    expect(response.body.message).toContain(MediaRefusals.quotaExceeded)
  })

  it('leaves neither a row nor a signature behind when it refuses on the quota', async () => {
    await configure({ quotaBytes: 4096 })

    await ask({ sizeBytes: 5000 })

    expect(await flow.mediaRowsOf(flow.ctx.one.school.id)).toEqual([])
    expect(flow.storage.calls.filter((call) => call.op === 'signUpload')).toEqual([])
  })

  it('counts the bytes outstanding grants promised, so parallel grants cannot overfill', async () => {
    await configure({ quotaBytes: 20480 })

    const statuses: number[] = []
    for (let attempt = 0; attempt < 10; attempt += 1) {
      statuses.push((await ask({ sizeBytes: 4096 })).status)
    }

    expect(statuses).toEqual([201, 201, 201, 201, 201, 413, 413, 413, 413, 413])
  })

  it('reports the bytes promised to grants that have not completed', async () => {
    await configure()

    await ask({ sizeBytes: 4096 })
    const usage = await flow.usageOf(flow.ctx.one.school.id, flow.ctx.one.users.owner)

    expect(usage.body).toMatchObject({ usedBytes: 0, reservedBytes: 4096 })
  })
})

describe('asking for permission to upload a file above the hashing limit', () => {
  const env = process.env
  let app: INestApplication
  let flow: MediaFlow

  beforeEach(async () => {
    process.env = { ...env }
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY

    // Lowered so a file that is "too large to hash in a browser" is a few
    // kilobytes here instead of a quarter of a gigabyte.
    process.env.VIDYA_MEDIA_HASH_LIMIT_BYTES = '1024'

    app = await createTestingApp()
    flow = await createMediaFlow(app)
    await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner)
  })

  afterEach(async () => {
    await app.close()
    process.env = env
  })

  const askUnhashed = async () =>
    flow.askUpload(
      flow.imageUpload(flow.ctx.one.school.id, { sizeBytes: 4096, sha256: undefined }),
      flow.ctx.one.users.owner,
    )

  it('binds no checksum to a file the browser was not asked to hash', async () => {
    const response = await askUnhashed()

    expect(response.status).toBe(201)
    expect(checksumKeys(response.body.grant as UploadGrant)).toEqual([])
  })

  it('keeps both copies of an unhashed file, because it cannot tell them apart', async () => {
    const first = await askUnhashed()
    const second = await askUnhashed()

    for (const granted of [first, second]) {
      await flow.putBytes(granted.body.grant as UploadGrant, Buffer.alloc(4096, 1))
      const completed = await flow.completeUpload(
        granted.body.mediaId,
        {},
        flow.ctx.one.users.owner,
      )
      expect(completed.status).toBe(200)
    }

    expect(second.body.mediaId).not.toBe(first.body.mediaId)
    expect(flow.objectBehind(second.body.grant as UploadGrant)).toBeDefined()
  })
})
